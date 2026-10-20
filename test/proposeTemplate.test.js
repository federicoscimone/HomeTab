import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { buildTemplateRequest, cellKind, checkTemplate, locateData, templateFromProposal } from '../lib/ai/tasks/proposeTemplate.js';
import { readSheetRows } from '../lib/utils/importParser.js';

// Un estratto conto come lo esporta una banca: preambolo con dati personali, titoli, movimenti.
const CSV = [
  'Estratto conto;;;;',
  'Intestatario;MARIO ROSSI;;;',
  'IBAN;IT60X0542811101000000123456;;;',
  'Saldo al 30/09/2026;;;;12.345,67',
  ';;;;',
  'Data contabile;Data valuta;Descrizione;Riferimento;Importo',
  '14/10/2026;14/10/2026;PAGAMENTO POS CARTA 782872 IKEA CATANIA;20261014000123;-189,90',
  '13/10/2026;13/10/2026;ADDEBITO SDD A2A ENERGIA SPA;20261013000456;-88,12',
  '12/10/2026;12/10/2026;BONIFICO A FAVORE DI GIUSEPPE VERDI AFFITTO;20261012000789;-750,00',
  '11/10/2026;11/10/2026;SATISPAY GIULIA ROSSI;20261011000111;-20,00',
  '10/10/2026;10/10/2026;ACCREDITO STIPENDIO;20261010000222;2.450,00',
  '09/10/2026;09/10/2026;PAGAMENTO POS DECATHLON;20261009000333;-54,99',
].join('\n');
const buffer = Buffer.from(CSV, 'utf8');
const rows = readSheetRows(buffer, true);

test('tipi di cella: date, importi, riferimenti lunghi, testo', () => {
  assert.equal(cellKind('14/10/2026'), 'date');
  assert.equal(cellKind('2026-10-14'), 'date');
  assert.equal(cellKind(46309), 'date');
  assert.equal(cellKind('-189,90'), 'amount');
  assert.equal(cellKind('2.450,00'), 'amount');
  assert.equal(cellKind(-54.99), 'amount');
  assert.equal(cellKind('20261014000123'), 'number');
  assert.equal(cellKind(4532015112830366), 'number');
  assert.equal(cellKind('PAGAMENTO POS'), 'text');
  assert.equal(cellKind(''), 'empty');
});

test('intestazione e dati trovati dal codice, preambolo escluso', () => {
  const loc = locateData(rows);
  assert.equal(loc.headerIndex, 5);
  assert.equal(loc.firstDataIndex, 6);
  assert.equal(loc.dataIndexes.length, 5);
  assert.equal(loc.width, 5);
});

test('nella richiesta non c\'è il preambolo né alcun dato personale', () => {
  const req = buildTemplateRequest(rows, 'csv');
  const sent = req.prompt;
  for (const secret of ['MARIO ROSSI', 'IT60X0542811101000000123456', '12.345,67', '782872', 'GIUSEPPE VERDI', 'GIULIA ROSSI', '20261014000123']) {
    assert.ok(!sent.includes(secret), `non deve partire: ${secret}`);
  }
  assert.equal(req.sent.rowsOmittedAboveTitles, 5);
  assert.deepEqual(req.sent.titles, { A: 'Data contabile', B: 'Data valuta', C: 'Descrizione', D: 'Riferimento', E: 'Importo' });
  assert.deepEqual(req.sent.rows[2], { A: '12/10/2026', B: '12/10/2026', C: 'BONIFICO A FAVORE DI [NOME] AFFITTO', D: '[NUM]', E: '-750,00' });
  assert.equal(req.sent.rows[3].C, 'SATISPAY [NOME]');
  // Date e importi restano: servono a capirne il formato. Le attività restano: servono a categorizzare.
  assert.equal(req.sent.rows[1].C, 'ADDEBITO SDD A2A ENERGIA SPA');
  assert.equal(req.sent.rows[0].E, '-189,90');
  assert.equal(buildTemplateRequest([['solo testo', 'nessuna data']], 'csv').error, 'noDataRows');
});

test('la proposta diventa un template valido e il parser vero la verifica', () => {
  const req = buildTemplateRequest(rows, 'csv');
  const template = templateFromProposal({
    columns: { date: 'A', description: 'C', payee: null, place: null, notes: 'Z', amount: 'e' },
    amountDebit: null, amountCredit: null, amountSign: 'negative_is_expense', dateFormat: 'DD/MM/YYYY',
    defaultPaymentMethod: null,
    methodKeywords: [{ keyword: 'pos', method: 'debit_card' }, { keyword: 'SDD', method: 'direct_debit' },
      { keyword: 'INVENTATA', method: 'cash' }, { keyword: 'POS', method: 'cash' }],
    name: '[NOME] banca', notes: '',
  }, req, { fileType: 'csv', fallbackName: 'estratto' });
  assert.equal(template.skipRows, 6);
  assert.equal(template.name, 'estratto');
  assert.deepEqual(template.columnMapping, { date: 'A', amount: 'E', description: 'C', payee: null, place: null, notes: null, bankCategory: null });
  assert.deepEqual(template.payeeMethodKeywords, [{ keyword: 'POS', method: 'debit_card' }, { keyword: 'SDD', method: 'direct_debit' }]);

  const check = checkTemplate(buffer, rows, template);
  assert.equal(check.dataRows, 6);
  assert.equal(check.parsed, 6);
  assert.deepEqual(check.sample[0], { date: '2026-10-14', amount: 189.9, type: 'expense', description: 'PAGAMENTO POS CARTA 782872 IKEA CATANIA', payee: '', paymentMethod: 'debit_card' });
  assert.equal(check.sample[4].type, 'income');
  assert.equal(check.sample[4].amount, 2450);
});
