/**
 * @fileoverview Template di import e estratto conto di esempio della demo.
 * @module lib/demoImport
 *
 * Senza un estratto conto vero l'importazione non si poteva provare: la demo non aveva template.
 * Il seed crea questo template e /api/import/sample genera un CSV compatibile, con date degli
 * ultimi giorni. Le righe coprono i casi che la revisione dell'import gestisce: esercenti con una
 * regola di categoria, esercenti senza, una riga senza metodo di pagamento riconoscibile, un
 * accredito e il doppione di un movimento già presente.
 *
 * Nessuna dipendenza dal server: il nome del template serve anche alla pagina di import.
 */

export const DEMO_TEMPLATE_NAME = 'Demo HomeTab (CSV)';

/** Documento ImportTemplate creato dal seed della demo. */
export const DEMO_IMPORT_TEMPLATE = {
  name: DEMO_TEMPLATE_NAME,
  fileType: 'csv',
  skipRows: 1,
  delimiter: ';',
  dateFormat: 'DD/MM/YYYY',
  columnMapping: { date: 'A', description: 'B', payee: 'C', amount: 'D' },
  amountSign: 'negative_is_expense',
  payeeMethodKeywords: [
    { keyword: 'POS', method: 'debit_card' },
    { keyword: 'SDD', method: 'direct_debit' },
    { keyword: 'BONIFICO', method: 'bank_transfer' },
    { keyword: 'SATISPAY', method: 'satispay' },
  ],
};

const pad = (n) => String(n).padStart(2, '0');
/** Il separatore di colonna non può comparire dentro un campo. */
const cell = (text) => String(text ?? '').replaceAll(';', ',');
const itAmount = (n) => n.toFixed(2).replace('.', ',');

/**
 * @param {Date} now
 * @param {{ date: string, amount: number, payee: string, description: string } | null} duplicateOf
 *   Un'uscita già presente da riproporre come doppione; null se il database è vuoto.
 * @returns {string} CSV con intestazione, separatore ";" e importi all'italiana.
 *
 * @example
 * demoImportSample(new Date(2026, 9, 7), null).split('\n')[1]
 * // '06/10/2026;PAGAMENTO POS;ESSELUNGA MILANO;-62,40'
 */
export function demoImportSample(now, duplicateOf) {
  const daysAgo = (n) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  const rows = [
    [daysAgo(1), 'PAGAMENTO POS', 'ESSELUNGA MILANO', -62.4],
    [daysAgo(1), 'PAGAMENTO POS', 'FARMACIA COMUNALE', -18.9],
    [daysAgo(2), 'ADDEBITO SDD', 'ENEL ENERGIA', -71.25],
    [daysAgo(2), 'PAGAMENTO SATISPAY', 'BAR CENTRALE', -3.2],
    [daysAgo(3), 'BONIFICO IN ENTRATA', 'RIMBORSO SPESE MEDICHE', 120],
    [daysAgo(3), 'PAGAMENTO POS', 'LIBRERIA FELTRINELLI', -24.5],
    [daysAgo(4), 'PAGAMENTO POS', 'Q8 VIA ROMA', -50],
    [daysAgo(5), 'PRELIEVO ATM', 'SPORTELLO', -100],
  ];
  if (duplicateOf) {
    const [y, m, d] = duplicateOf.date.split('-');
    rows.push([`${d}/${m}/${y}`, duplicateOf.description, duplicateOf.payee, -duplicateOf.amount]);
  }
  const lines = rows.map(([date, description, payee, amount]) =>
    [date, cell(description), cell(payee), itAmount(amount)].join(';'));
  return ['Data;Descrizione;Esercente;Importo', ...lines].join('\n') + '\n';
}
