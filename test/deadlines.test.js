import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsToDate, advance, detectPeriodic, findPayment, monthlyReserve, reminderStage, upcoming,
} from '../lib/utils/deadlines.js';

const TODAY = '2026-10-22';

test('mesi in avanti: il 31 gennaio diventa l\'ultimo di febbraio', () => {
  assert.equal(addMonthsToDate('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsToDate('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonthsToDate('2028-02-29', 12), '2029-02-28');
});

test('quota da accantonare: solo per le scadenze non mensili', () => {
  assert.equal(monthlyReserve({ amount: 600, everyMonths: 12 }), 50);
  assert.equal(monthlyReserve({ amount: 90, everyMonths: 1 }), 0);
  assert.equal(monthlyReserve({ amount: null, everyMonths: 12 }), 0);
  assert.equal(monthlyReserve({ amount: 600, everyMonths: 12, active: false }), 0);
});

test('pagata: avanza di un periodo, o fino al primo nel futuro; una tantum si chiude', () => {
  assert.deepEqual(advance({ nextDate: '2026-10-30', everyMonths: 12 }, TODAY), { nextDate: '2027-10-30', active: true });
  assert.deepEqual(advance({ nextDate: '2026-01-10', everyMonths: 3 }, TODAY), { nextDate: '2027-01-10', active: true });
  assert.deepEqual(advance({ nextDate: '2026-10-30', everyMonths: null }, TODAY), { nextDate: '2026-10-30', active: false });
});

test('promemoria: preavviso entrando nella finestra, poi il giorno, una volta ciascuno', () => {
  const d = { active: true, remindDays: 7, nextDate: '2026-10-27', notified: [] };
  assert.equal(reminderStage(d, TODAY), 'before');
  assert.equal(reminderStage({ ...d, notified: ['before'] }, TODAY), null);
  assert.equal(reminderStage({ ...d, notified: ['before'] }, '2026-10-27'), 'due');
  assert.equal(reminderStage({ ...d, notified: ['before'] }, '2026-10-29'), 'due'); // non segnata pagata
  assert.equal(reminderStage({ ...d, notified: ['before', 'due'] }, '2026-10-29'), null);
  assert.equal(reminderStage({ ...d, remindDays: 0 }, TODAY), null);
  assert.equal(reminderStage({ ...d, nextDate: '2026-12-01' }, TODAY), null);
});

test('prossime scadenze in ordine, comprese quelle passate non pagate', () => {
  const list = upcoming([
    { title: 'b', active: true, nextDate: '2026-11-10' },
    { title: 'a', active: true, nextDate: '2026-10-20' },
    { title: 'lontana', active: true, nextDate: '2027-03-01' },
    { title: 'chiusa', active: false, nextDate: '2026-10-25' },
  ], TODAY, 30);
  assert.deepEqual(list.map((d) => [d.title, d.daysLeft]), [['a', -2], ['b', 19]]);
});

const mov = (date, amount, payee, paymentMethod = 'bank_transfer') => ({ date, amount, payee, description: '', categoryId: 'c', paymentMethod });

test('spese periodiche: assicurazione annuale e TARI trimestrale, non la spesa mensile', () => {
  const rows = [
    mov('2024-11-03', 610, 'UNIPOL ASSICURAZIONI'), mov('2025-11-05', 640, 'UNIPOL ASSICURAZIONI'),
    mov('2026-01-15', 80, 'COMUNE TARI'), mov('2026-04-16', 80, 'COMUNE TARI'), mov('2026-07-15', 82, 'COMUNE TARI'),
    mov('2026-08-01', 50, 'ESSELUNGA'), mov('2026-09-01', 55, 'ESSELUNGA'), mov('2026-10-01', 52, 'ESSELUNGA'),
    mov('2023-05-01', 300, 'VECCHIO'), mov('2024-05-02', 300, 'VECCHIO'), // finita: niente nel 2025
    mov('2024-12-15', 75, 'PASTICCERIA', 'credit_card'), mov('2025-12-15', 75, 'PASTICCERIA', 'credit_card'), // con carta, due volte sole
  ];
  const found = detectPeriodic(rows, TODAY);
  assert.deepEqual(found.map((f) => [f.match, f.everyMonths, f.nextDate, f.amount]), [
    ['COMUNE TARI', 3, '2026-10-15', 82],
    ['UNIPOL ASSICURAZIONI', 12, '2026-11-05', 640],
  ]);
});

test('pagamento riconosciuto: stesse parole, importo vicino, vicino alla scadenza', () => {
  const d = { title: 'Assicurazione auto', match: 'UNIPOL', amount: 640, nextDate: '2026-11-05' };
  const rows = [mov('2026-10-20', 655, 'UNIPOL SAI'), mov('2026-10-21', 20, 'UNIPOL SAI'), mov('2025-11-05', 640, 'UNIPOL')];
  assert.equal(findPayment(d, rows, TODAY).date, '2026-10-20');
  assert.equal(findPayment({ ...d, match: 'GENERALI' }, rows, TODAY), null);
});
