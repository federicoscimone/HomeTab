import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsToDate, advance, analyzePeriodic, detectPeriodic, findPayment, monthlyReserve, reminderStage, upcoming,
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

test('spese periodiche: assicurazione annuale e TARI trimestrale, non la spesa di tutti i giorni', () => {
  const rows = [
    mov('2024-11-03', 610, 'UNIPOL ASSICURAZIONI'), mov('2025-11-05', 640, 'UNIPOL ASSICURAZIONI'),
    mov('2026-01-15', 80, 'COMUNE TARI'), mov('2026-04-16', 80, 'COMUNE TARI'), mov('2026-07-15', 82, 'COMUNE TARI'),
    mov('2023-05-01', 300, 'VECCHIO'), mov('2024-05-02', 300, 'VECCHIO'), // finita: niente nel 2025
  ];
  // Il supermercato ogni settimana: più volte al mese, non è una scadenza.
  for (const m of ['08', '09', '10']) for (const d of ['01', '08', '15', '22']) rows.push(mov(`2026-${m}-${d}`, 60 + Number(d), 'ESSELUNGA', 'debit_card'));
  const found = detectPeriodic(rows, TODAY);
  assert.deepEqual(found.map((f) => [f.match, f.everyMonths, f.nextDate, f.amount]), [
    ['COMUNE TARI', 3, '2026-10-15', 82],
    ['UNIPOL ASSICURAZIONI', 12, '2026-11-05', 640],
  ]);
});

test('bollette: mensili e bimestrali, con importi che cambiano con le stagioni', () => {
  const rows = [
    ...['2026-02-05', '2026-04-06', '2026-06-05', '2026-08-04', '2026-10-05'].map((d, i) => mov(d, [140, 95, 60, 55, 110][i], 'ENEL ENERGIA', 'debit_card')),
    ...['2026-06-10', '2026-07-10', '2026-08-11', '2026-09-10', '2026-10-10'].map((d) => mov(d, 29.9, 'VODAFONE', 'credit_card')),
  ];
  const found = analyzePeriodic(rows, TODAY).found;
  const enel = found.find((f) => f.match === 'ENEL ENERGIA');
  assert.deepEqual([enel.everyMonths, enel.variable, enel.amount, enel.nextDate], [2, true, 60, '2026-12-05']);
  const vodafone = found.find((f) => f.match === 'VODAFONE');
  assert.deepEqual([vodafone.everyMonths, vodafone.variable], [1, false]);
});

test('un pagamento mancante nei dati non rompe la serie', () => {
  const rows = ['2026-04-10', '2026-05-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10'].map((d) => mov(d, 9.99, 'SPOTIFY', 'credit_card'));
  assert.equal(detectPeriodic(rows, TODAY)[0].everyMonths, 1);
});

test('annuali viste due volte: con carta servono parole da bolletta, altrimenti è un «quasi»', () => {
  const panettone = [mov('2024-12-15', 75, 'PASTICCERIA', 'credit_card'), mov('2025-12-15', 75, 'PASTICCERIA', 'credit_card')];
  const r = analyzePeriodic(panettone, TODAY);
  assert.deepEqual(r.found, []);
  assert.deepEqual(r.nearMisses, [{ title: 'PASTICCERIA', occurrences: 2, reason: 'yearlyUnconfirmed' }]);
  const polizza = [mov('2024-12-01', 300, 'ASSICURAZIONE CASA GENERALI', 'credit_card'), mov('2025-12-02', 310, 'ASSICURAZIONE CASA GENERALI', 'credit_card')];
  assert.equal(detectPeriodic(polizza, TODAY)[0].everyMonths, 12);
});

test('luce e gas dallo stesso esercente nello stesso mese: due serie per fascia d\'importo', () => {
  const rows = [];
  for (const m of ['06', '07', '08', '09', '10']) {
    rows.push(mov(`2026-${m}-05`, 80, 'A2A ENERGIA', 'bank_transfer'));
    rows.push(mov(`2026-${m}-06`, 30, 'A2A ENERGIA', 'bank_transfer'));
  }
  // Le cifre non contano nel nome dell'esercente (sono spesso riferimenti): la chiave è «ENERGIA».
  const found = detectPeriodic(rows, TODAY);
  assert.deepEqual(found.map((f) => [f.match, f.amount]).sort((a, b) => a[1] - b[1]), [['ENERGIA', 30], ['ENERGIA', 80]]);
});

test('un esercente con un nome di sigle e cifre («A2A») resta riconoscibile', () => {
  const rows = ['2026-06-06', '2026-07-06', '2026-08-06', '2026-09-07', '2026-10-06'].map((d) => mov(d, 30, 'A2A', 'bank_transfer'));
  assert.deepEqual(detectPeriodic(rows, TODAY).map((f) => [f.match, f.everyMonths]), [['A2A', 1]]);
});

test('i «quasi» sono spese programmate, non abitudini a importi casuali', () => {
  const rows = ['2026-01-03', '2026-02-20', '2026-05-01', '2026-09-25'].map((d, i) => mov(d, [12, 31, 9, 22][i], 'PIZZERIA DA GINO', 'cash'));
  // Più volte al mese, a caso: nemmeno le fasce d'importo la rendono un «quasi».
  for (const d of ['2026-03-02', '2026-03-09', '2026-07-04', '2026-07-18']) rows.push(mov(d, 15, 'PIZZERIA DA GINO', 'cash'));
  assert.deepEqual(analyzePeriodic(rows, TODAY).nearMisses, []);
});

test('quasi riconosciute: intervalli irregolari e spese finite, con il motivo', () => {
  const rows = [
    ...['2026-01-03', '2026-02-20', '2026-05-01', '2026-09-25'].map((d) => mov(d, 45, 'PALESTRA FIT', 'debit_card')),
    ...['2025-01-10', '2025-02-10', '2025-03-10', '2025-04-10'].map((d) => mov(d, 12, 'VECCHIO ABBONAMENTO', 'credit_card')),
  ];
  const misses = analyzePeriodic(rows, TODAY).nearMisses;
  assert.deepEqual(misses.map((x) => [x.title, x.reason]).sort(), [['PALESTRA FIT', 'irregular'], ['VECCHIO ABBONAMENTO', 'ended']]);
});

test('pagamento riconosciuto: stesse parole, importo vicino, vicino alla scadenza', () => {
  const d = { title: 'Assicurazione auto', match: 'UNIPOL', amount: 640, nextDate: '2026-11-05' };
  const rows = [mov('2026-10-20', 655, 'UNIPOL SAI'), mov('2026-10-21', 20, 'UNIPOL SAI'), mov('2025-11-05', 640, 'UNIPOL')];
  assert.equal(findPayment(d, rows, TODAY).date, '2026-10-20');
  assert.equal(findPayment({ ...d, match: 'GENERALI' }, rows, TODAY), null);
  assert.equal(findPayment({ title: 'Gas', match: 'A2A', amount: 30, nextDate: '2026-11-06' }, [mov('2026-10-20', 31, 'A2A')], TODAY).amount, 31);
});
