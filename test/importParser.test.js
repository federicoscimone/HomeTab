import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseExcelBuffer, parsePasteText, parseAmountRaw } from '../lib/utils/importParser.js';

// I casi coprono ciò che dipende dalla libreria SheetJS: lettura di .xlsx con date seriali,
// CSV con importi in formato italiano, fogli che non partono dalla colonna A.

/** @param {Array<Array<any>>} rows @param {string} [origin] */
function xlsxBuffer(rows, origin) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, origin ? { origin } : undefined), 'Movimenti');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const SINGLE_COLUMN = {
  fileType: 'xlsx',
  skipRows: 1,
  dateFormat: 'DD/MM/YYYY',
  columnMapping: { date: 'A', description: 'B', amount: 'C' },
  amountSign: 'negative_is_expense',
};

test('xlsx: date seriali di Excel e segno degli importi', () => {
  // 46178 = 2026-06-05 nel sistema di date di Excel
  const buffer = xlsxBuffer([
    ['Data', 'Descrizione', 'Importo'],
    [46178, 'ESSELUNGA MILANO', -82.4],
    [46179, 'STIPENDIO', 2100],
  ]);
  const rows = parseExcelBuffer(buffer, SINGLE_COLUMN);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].date, rows[0].amount, rows[0].type], ['2026-06-05', 82.4, 'expense']);
  assert.deepEqual([rows[1].date, rows[1].amount, rows[1].type], ['2026-06-06', 2100, 'income']);
});

test('xlsx: foglio che parte dalla colonna B, lettere del template invariate', () => {
  const buffer = xlsxBuffer([
    ['Data', 'Descrizione', 'Importo'],
    ['05/06/2026', 'FARMACIA', -12.5],
  ], 'B1');
  const rows = parseExcelBuffer(buffer, { ...SINGLE_COLUMN, columnMapping: { date: 'B', description: 'C', amount: 'D' } });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].date, rows[0].description, rows[0].amount], ['2026-06-05', 'FARMACIA', 12.5]);
});

test('csv: importi italiani con migliaia e decimali, separatore punto e virgola', () => {
  const csv = 'Data;Descrizione;Importo\n05/06/2026;MOBILI;-1.453,79\n06/06/2026;RIMBORSO;10,00\n';
  const rows = parseExcelBuffer(Buffer.from(csv, 'utf8'), { ...SINGLE_COLUMN, fileType: 'csv', delimiter: ';' });
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].amount, rows[0].type], [1453.79, 'expense']);
  assert.deepEqual([rows[1].amount, rows[1].type], [10, 'income']);
});

test('colonne separate per uscite ed entrate', () => {
  const buffer = xlsxBuffer([
    ['Data', 'Descrizione', 'Uscite', 'Entrate'],
    ['05/06/2026', 'BOLLETTA LUCE', 64.1, ''],
    ['06/06/2026', 'BONIFICO', '', 300],
  ]);
  const rows = parseExcelBuffer(buffer, {
    ...SINGLE_COLUMN,
    columnMapping: { date: 'A', description: 'B' },
    amountDebit: 'C',
    amountCredit: 'D',
  });
  assert.deepEqual(rows.map((r) => [r.type, r.amount]), [['expense', 64.1], ['income', 300]]);
});

test('testo incollato separato da tabulazioni', () => {
  const rows = parsePasteText('05/06/2026\tBAR CENTRALE\t-3,20', { ...SINGLE_COLUMN, skipRows: 0, delimiter: '\t' });
  assert.deepEqual([rows[0].date, rows[0].amount, rows[0].type], ['2026-06-05', 3.2, 'expense']);
});

test('parseAmountRaw: formati italiano e americano', () => {
  assert.deepEqual(parseAmountRaw('-1.234,56'), { amount: 1234.56, negative: true });
  assert.deepEqual(parseAmountRaw('1,234.56'), { amount: 1234.56, negative: false });
  // Il segno "+" degli accrediti non deve cambiare l'interpretazione del formato.
  assert.deepEqual(parseAmountRaw('+120,00'), { amount: 120, negative: false });
  assert.deepEqual(parseAmountRaw('+1.234,56'), { amount: 1234.56, negative: false });
});

test('il CSV di esempio della demo si importa con il suo template', async () => {
  const { DEMO_IMPORT_TEMPLATE, demoImportSample } = await import('../lib/demoImport.js');
  const duplicate = { date: '2026-10-07', amount: 46.78, payee: 'Q8', description: 'Benzina - auto Marco' };
  const csv = demoImportSample(new Date(2026, 9, 7), duplicate);
  const rows = parseExcelBuffer(Buffer.from(csv, 'utf8'), DEMO_IMPORT_TEMPLATE);

  assert.equal(rows.length, 9);
  assert.deepEqual(rows[0], {
    date: '2026-10-06', description: 'PAGAMENTO POS', payee: 'ESSELUNGA MILANO', place: '', notes: '', bankCategory: '',
    paymentMethod: 'debit_card', _methodAutoDetected: true, amount: 62.4, type: 'expense',
  });
  const refund = rows.find((r) => r.payee === 'RIMBORSO SPESE MEDICHE');
  assert.equal(refund.type, 'income');
  assert.equal(refund.amount, 120);
  // Il prelievo non contiene parole chiave di metodo: la revisione lo segnala.
  assert.equal(rows.find((r) => r.payee === 'SPORTELLO')._methodAutoDetected, false);
  assert.deepEqual(rows.at(-1), {
    date: '2026-10-07', description: 'Benzina - auto Marco', payee: 'Q8', place: '', notes: '', bankCategory: '',
    paymentMethod: null, _methodAutoDetected: false, amount: 46.78, type: 'expense',
  });
});
