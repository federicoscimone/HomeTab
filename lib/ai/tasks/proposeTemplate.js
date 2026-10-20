/**
 * @fileoverview Proposta di un template di import per un estratto conto mai visto.
 * @module lib/ai/tasks/proposeTemplate
 *
 * Cosa parte verso il modello, e cosa no:
 * - il codice trova da solo la prima riga di dati (una data e un importo) e l'intestazione sopra
 *   di essa. Tutto ciò che sta sopra l'intestazione (intestatario, numero di conto, IBAN, saldi)
 *   **non parte**: il modello sa solo quante righe sono state omesse. Anche le righe da saltare le
 *   calcola il codice;
 * - partono i titoli delle colonne e le prime 5 righe di dati. Date e importi restano com'erano,
 *   perché servono a capirne il formato; i numeri lunghi senza decimali (riferimenti, conti)
 *   diventano [NUM]; i testi passano da `maskTextCells`, con le stesse regole dell'import.
 *
 * Il modello propone colonne, formato della data, segno degli importi e parole chiave per il
 * metodo di pagamento. La proposta viene poi provata con il parser vero dell'app su tutto il file:
 * l'utente la vede già verificata, la corregge se serve e la salva lui.
 */

import { maskTextCells } from '../mask.js';
import { runStructured } from '../index.js';
import { PAYMENT_METHODS } from '../../utils/payments.js';
import { colToIndex, indexToCol, parseExcelBuffer } from '../../utils/importParser.js';

export const SAMPLE_ROWS = 5;
const CELL_MAX = 80;
const MAX_COLUMNS = 30;
export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'D/M/YYYY'];
const SIGNS = ['absolute', 'negative_is_income', 'negative_is_expense'];
const METHODS = PAYMENT_METHODS.map((m) => m.value);

const DATE_RE = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})(\s+\d{1,2}[:.]\d{2}([:.]\d{2})?)?$/;
const AMOUNT_RE = /^[-+]?\s?(€\s?)?\d{1,3}([.,' ]?\d{3})*([.,]\d{1,2})?\s?(€|EUR)?$/i;

/** @returns {'empty'|'date'|'amount'|'number'|'text'} Che cosa contiene una cella. */
export function cellKind(value) {
  if (value === '' || value === null || value === undefined) return 'empty';
  if (typeof value === 'number') {
    // Un numero seriale di Excel fra il 2009 e il 2064 è quasi certamente una data.
    if (Number.isInteger(value) && value >= 40_000 && value <= 60_000) return 'date';
    if (Number.isInteger(value) && Math.abs(value) >= 100_000) return 'number';
    return 'amount';
  }
  const s = String(value).trim();
  if (!s) return 'empty';
  if (DATE_RE.test(s)) return 'date';
  // Cifre senza separatori né decimali e lunghe: un riferimento, non un importo.
  if (/^\d{6,}$/.test(s)) return 'number';
  if (AMOUNT_RE.test(s)) return 'amount';
  return 'text';
}

const isDataRow = (row) => {
  const kinds = row.map(cellKind);
  return kinds.includes('date') && kinds.includes('amount');
};

/**
 * Dove sono intestazione e dati.
 * @param {Array<Array<any>>} rows
 * @returns {{ headerIndex: number|null, firstDataIndex: number, dataIndexes: number[], width: number } | null}
 *   null se il file non ha righe con una data e un importo.
 */
export function locateData(rows) {
  const firstDataIndex = rows.findIndex(isDataRow);
  if (firstDataIndex < 0) return null;
  let headerIndex = null;
  for (let i = firstDataIndex - 1; i >= 0; i -= 1) {
    const texts = rows[i].filter((c) => cellKind(c) === 'text').length;
    if (texts >= 2) { headerIndex = i; break; }
    if (rows[i].some((c) => cellKind(c) !== 'empty')) break;
  }
  const dataIndexes = [];
  for (let i = firstDataIndex; i < rows.length && dataIndexes.length < SAMPLE_ROWS; i += 1) {
    if (isDataRow(rows[i])) dataIndexes.push(i);
  }
  const used = [headerIndex, ...dataIndexes].filter((i) => i !== null).map((i) => rows[i]);
  const width = Math.min(MAX_COLUMNS, Math.max(...used.map((r) => {
    let last = r.length - 1;
    while (last >= 0 && cellKind(r[last]) === 'empty') last -= 1;
    return last + 1;
  })));
  return { headerIndex, firstDataIndex, dataIndexes, width };
}

/** Una riga come oggetto { A: …, B: … }, con i testi mascherati e accorciati. */
function sampleRow(row, width, { header = false } = {}) {
  const cells = Array.from({ length: width }, (_, i) => row[i] ?? '');
  const kinds = cells.map(cellKind);
  const textIdx = kinds.map((k, i) => (k === 'text' ? i : -1)).filter((i) => i >= 0);
  // L'intestazione ha solo titoli di colonna: identificativi via, ma niente regole sui nomi,
  // che scambierebbero «Data contabile» per una persona.
  const masked = header
    ? textIdx.map((i) => maskTextCells([String(cells[i])])[0])
    : maskTextCells(textIdx.map((i) => String(cells[i])));
  const out = {};
  cells.forEach((value, i) => {
    let v;
    if (kinds[i] === 'empty') v = '';
    else if (kinds[i] === 'number') v = '[NUM]';
    else if (kinds[i] === 'text') v = masked[textIdx.indexOf(i)].slice(0, CELL_MAX);
    else v = typeof value === 'number' ? value : String(value).trim();
    out[indexToCol(i)] = v;
  });
  return out;
}

const SYSTEM = `You configure the import of a bank or card statement into a family budgeting app.

You get the column titles and the first rows of the file, as objects keyed by column letter.
Rows above the titles were removed for privacy. Personal data in the cells was replaced by
placeholders such as [NUM], [CARTA], [IBAN], [CF], [EMAIL] and [NOME].

Answer with:
- columns: the letter of the column holding each field, or null when the file has none.
  date: the transaction (or value) date. description: the bank's description of the operation.
  payee: the merchant or counterparty, if it has its own column. place: only if present.
  notes: only a column of free-text notes written by the account holder; never references,
  transaction ids, codes or balances (leave those unmapped).
  amount: a single column with signed or unsigned amounts.
- amountDebit / amountCredit: use them instead of amount when outflows and inflows are in two
  separate columns; otherwise null.
- amountSign, only for a single amount column: "negative_is_expense" if outflows are negative,
  "negative_is_income" if inflows are negative, "absolute" if all amounts are positive.
- dateFormat: one of the listed formats, matching the date column.
- defaultPaymentMethod: a payment method from the list only when every row clearly uses it (for
  example a credit card statement); otherwise null.
- methodKeywords: words that appear in the descriptions and reveal the payment method (e.g.
  "POS" → debit_card, "SDD" → direct_debit, "BONIFICO" → bank_transfer). Only words you saw.
- name: the bank or card name only if it is evident from the titles or descriptions; otherwise
  "" (never a generic name like "Bank statement").
- notes: one short sentence on anything uncertain, or "".

Write name and notes in the language given in "language".`;

const LETTER = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const SCHEMA = {
  type: 'object',
  properties: {
    columns: {
      type: 'object',
      properties: { date: LETTER, description: LETTER, payee: LETTER, place: LETTER, notes: LETTER, amount: LETTER },
      required: ['date', 'description', 'payee', 'place', 'notes', 'amount'],
      additionalProperties: false,
    },
    amountDebit: LETTER,
    amountCredit: LETTER,
    amountSign: { type: 'string', enum: SIGNS },
    dateFormat: { type: 'string', enum: DATE_FORMATS },
    defaultPaymentMethod: { anyOf: [{ type: 'string', enum: METHODS }, { type: 'null' }] },
    methodKeywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: { keyword: { type: 'string' }, method: { type: 'string', enum: METHODS } },
        required: ['keyword', 'method'],
        additionalProperties: false,
      },
    },
    name: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['columns', 'amountDebit', 'amountCredit', 'amountSign', 'dateFormat', 'defaultPaymentMethod', 'methodKeywords', 'name', 'notes'],
  additionalProperties: false,
};

/**
 * La richiesta esattamente come partirebbe, senza inviarla. La usano sia la proposta vera sia
 * l'anteprima «Vedi cosa viene inviato».
 *
 * @param {Array<Array<any>>} rows - Da readSheetRows.
 * @param {'csv'|'xlsx'} fileType
 * @param {string} [language] - Lingua dell'interfaccia, per nome e nota della proposta.
 * @returns {{ error: string } | { system: string, schema: object, prompt: string, sent: object,
 *   location: ReturnType<typeof locateData> }}
 */
export function buildTemplateRequest(rows, fileType, language = 'it') {
  const location = locateData(rows);
  if (!location) return { error: 'noDataRows' };
  const { headerIndex, dataIndexes, width } = location;
  const sent = {
    fileType,
    rowsOmittedAboveTitles: headerIndex ?? location.firstDataIndex,
    columns: Array.from({ length: width }, (_, i) => indexToCol(i)),
    titles: headerIndex !== null ? sampleRow(rows[headerIndex], width, { header: true }) : null,
    rows: dataIndexes.map((i) => sampleRow(rows[i], width)),
    dateFormats: DATE_FORMATS,
    paymentMethods: METHODS,
    language: language === 'en' ? 'English' : 'Italian',
  };
  return { system: SYSTEM, schema: SCHEMA, prompt: JSON.stringify(sent), sent, location };
}

/**
 * Dalla risposta del modello a un template valido per il modello ImportTemplate.
 * Lettere fuori dal file, formati sconosciuti e parole chiave mai viste vengono scartati.
 *
 * @param {object} data - JSON della risposta.
 * @param {{ sent: object, location: object }} request
 * @param {{ fileType: string, fallbackName: string }} opts
 */
export function templateFromProposal(data, request, { fileType, fallbackName }) {
  const valid = new Set(request.sent.columns);
  const col = (v) => (typeof v === 'string' && valid.has(v.trim().toUpperCase()) ? v.trim().toUpperCase() : null);
  const c = data?.columns ?? {};
  const debit = col(data?.amountDebit);
  const credit = col(data?.amountCredit);
  const split = Boolean(debit || credit);
  const seenText = JSON.stringify(request.sent.rows).toUpperCase();
  const keywords = (Array.isArray(data?.methodKeywords) ? data.methodKeywords : [])
    .map((k) => ({ keyword: String(k?.keyword ?? '').trim().toUpperCase(), method: k?.method }))
    .filter((k) => /^[\p{L}\d ]{2,20}$/u.test(k.keyword) && METHODS.includes(k.method) && seenText.includes(k.keyword))
    .filter((k, i, all) => all.findIndex((x) => x.keyword === k.keyword) === i)
    .slice(0, 12);
  const name = typeof data?.name === 'string' && data.name.trim() && !/\[[A-Z]+\]/.test(data.name)
    ? data.name.trim().slice(0, 60)
    : fallbackName;

  return {
    name,
    fileType,
    // Le righe da saltare le conta il codice: sono quelle sopra la prima riga di dati.
    skipRows: request.location.firstDataIndex,
    delimiter: ';',
    dateFormat: DATE_FORMATS.includes(data?.dateFormat) ? data.dateFormat : 'DD/MM/YYYY',
    columnMapping: {
      date: col(c.date), amount: split ? null : col(c.amount), description: col(c.description),
      payee: col(c.payee), place: col(c.place), notes: col(c.notes),
    },
    amountDebit: split ? debit : null,
    amountCredit: split ? credit : null,
    amountSign: SIGNS.includes(data?.amountSign) ? data.amountSign : 'absolute',
    defaultPaymentMethod: METHODS.includes(data?.defaultPaymentMethod) ? data.defaultPaymentMethod : null,
    payeeMethodKeywords: data?.defaultPaymentMethod ? [] : keywords,
  };
}

/**
 * Prova il template proposto con il parser vero, su tutto il file.
 * @returns {{ parsed: number, dataRows: number, sample: object[] }}
 *   `dataRows`: righe con una data e un importo, cioè quelle che il template dovrebbe leggere.
 */
export function checkTemplate(buffer, rows, template) {
  let results = [];
  try {
    results = parseExcelBuffer(buffer, template);
  } catch {
    results = [];
  }
  const dateCol = colToIndex(template.columnMapping.date);
  const dataRows = rows.slice(template.skipRows).filter((r) => dateCol >= 0 && cellKind(r[dateCol]) === 'date').length;
  return {
    parsed: results.length,
    dataRows,
    sample: results.slice(0, SAMPLE_ROWS).map(({ date, amount, type, description, payee, paymentMethod }) => ({
      date, amount, type, description, payee, paymentMethod,
    })),
  };
}

/**
 * Chiede la proposta al modello e la verifica.
 * @returns {Promise<{ template: object, check: object, notes: string, costMicro: number, model: string }>}
 * @throws {AiError} come runStructured.
 */
export async function proposeTemplate({ buffer, rows, request, fileType, fallbackName, userId }) {
  const res = await runStructured({
    task: 'importTemplate',
    system: request.system,
    prompt: request.prompt,
    schema: request.schema,
    maxTokens: 4_000,
    userId,
  });
  const template = templateFromProposal(res.data, request, { fileType, fallbackName });
  return {
    template,
    check: checkTemplate(buffer, rows, template),
    notes: typeof res.data?.notes === 'string' ? res.data.notes.slice(0, 300) : '',
    costMicro: res.costMicro,
    model: res.model,
  };
}
