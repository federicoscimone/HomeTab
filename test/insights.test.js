import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anomalySignals, goalImpact, growthSignals, istatSignals, rankSignals, recurringSignals,
} from '../lib/utils/insights.js';
import { readAdvice, signalView } from '../lib/ai/tasks/advice.js';

const TODAY = '2026-10-21';
const mov = (date, amount, payee, categoryId = 'svago', description = '') => ({ date, amount, payee, categoryId, description });

test('ricorrente: stesso esercente e importo ogni mese, attivo', () => {
  const rows = ['2026-05-03', '2026-06-03', '2026-07-03', '2026-08-03', '2026-09-03', '2026-10-03']
    .map((d) => mov(d, 12.99, 'NETFLIX.COM'));
  const [s] = recurringSignals(rows, { today: TODAY });
  assert.equal(s.key, 'recurring:NETFLIX');
  assert.equal(s.monthly, 12.99);
  assert.equal(s.potential, 155.88);
  assert.equal(s.months, 6);
});

test('ricorrente: un pagamento ogni tre mesi non è mensile, uno saltato sì', () => {
  const quarterly = ['2026-04-16', '2026-07-16', '2026-10-16'].map((d) => mov(d, 92, 'COMUNE DI MILANO'));
  assert.deepEqual(recurringSignals(quarterly, { today: TODAY }), []);
  const skipped = ['2026-05-10', '2026-06-10', '2026-08-10', '2026-09-10', '2026-10-10'].map((d) => mov(d, 9.99, 'SPOTIFY'));
  assert.equal(recurringSignals(skipped, { today: TODAY }).length, 1);
});

test('ricorrente: niente spesa al supermercato, disdette, affitti', () => {
  const grocery = [];
  for (const m of ['05', '06', '07', '08', '09', '10']) for (const d of ['02', '09', '16']) grocery.push(mov(`2026-${m}-${d}`, 60, 'ESSELUNGA'));
  const cancelled = ['2026-04-05', '2026-05-05', '2026-06-05', '2026-07-05'].map((d) => mov(d, 9.99, 'SPOTIFY'));
  const rent = ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'].map((d) => mov(d, 900, 'PROPRIETARIO'));
  assert.deepEqual(recurringSignals([...grocery, ...cancelled, ...rent], { today: TODAY }), []);
});

test('crescita: ultimi 3 mesi completi contro gli stessi mesi dell\'anno prima', () => {
  const rows = [
    mov('2025-07-10', 100, 'X', 'ristoranti'), mov('2025-08-10', 100, 'X', 'ristoranti'), mov('2025-09-10', 100, 'X', 'ristoranti'),
    mov('2026-07-10', 150, 'X', 'ristoranti'), mov('2026-08-10', 150, 'X', 'ristoranti'), mov('2026-09-10', 150, 'X', 'ristoranti'),
    mov('2026-10-05', 999, 'X', 'ristoranti'), // mese in corso: non conta
  ];
  const [s] = growthSignals(rows, { today: TODAY });
  assert.equal(s.from, '2026-07-01');
  assert.equal(s.to, '2026-09-30');
  assert.equal(s.prevTo, '2025-09-30');
  assert.equal(s.recentMonthly, 150);
  assert.equal(s.previousMonthly, 100);
  assert.equal(s.pct, 50);
  assert.equal(s.potential, 600);
});

test('crescita: senza dati dell\'anno prima non c\'è confronto', () => {
  assert.deepEqual(growthSignals([mov('2026-08-10', 500, 'X')], { today: TODAY }), []);
});

test('mese anomalo: settembre molto sopra la media dei 6 mesi prima', () => {
  const rows = ['03', '04', '05', '06', '07', '08'].map((m) => mov(`2026-${m}-15`, 100, 'X', 'salute'));
  rows.push(mov('2026-09-15', 400, 'X', 'salute'));
  const [s] = anomalySignals(rows, { today: TODAY });
  assert.equal(s.month, '2026-09');
  assert.equal(s.average, 100);
  assert.equal(s.potential, 300);
  assert.equal(s.monthlySaving, null);
});

test('mese anomalo: con meno di 6 mesi di dati la media non dice niente', () => {
  assert.deepEqual(anomalySignals([mov('2026-08-15', 10, 'X'), mov('2026-09-15', 400, 'X')], { today: TODAY }), []);
});

test('famiglie simili: capitoli ben sopra la media, casa esclusa', () => {
  const rows = [
    { code: '01', yours: 755, istat: 620, diff: 135, pct: 21.8 },
    { code: '04', yours: 1143, istat: 481, diff: 662, pct: 137.6 },
    { code: '07', yours: 400, istat: 380, diff: 20, pct: 5.3 },
  ];
  assert.deepEqual(istatSignals({ rows }).map((s) => [s.key, s.potential]), [['istat:01', 1620]]);
});

test('ordine per risparmio possibile, senza i nascosti e con un tetto per tipo', () => {
  const s = [
    { key: 'a', kind: 'recurring', potential: 100 }, { key: 'b', kind: 'recurring', potential: 300 },
    { key: 'c', kind: 'recurring', potential: 200 }, { key: 'd', kind: 'growth', potential: 50 },
  ];
  assert.deepEqual(rankSignals(s, { hidden: new Set(['b']), perKind: 1 }).map((x) => x.key), ['c', 'd']);
});

test('obiettivo: quanti mesi prima con un risparmio in più', () => {
  assert.deepEqual(goalImpact({ remaining: 1000, expectedQuota: 100 }, 100, '2026-10'), { monthsEarlier: 5, reachMonth: '2027-02' });
  assert.deepEqual(goalImpact({ remaining: 1000, expectedQuota: 0 }, 250, '2026-10'), { monthsEarlier: null, reachMonth: '2027-01' });
  assert.equal(goalImpact({ remaining: 1000, expectedQuota: 500 }, 5, '2026-10'), null); // nessun mese guadagnato
});

test('vista per il modello: esercente mascherato se è un bonifico a una persona', () => {
  const s = {
    key: 'recurring:BONIFICO', kind: 'recurring', monthly: 150, potential: 1800, months: 4, lastDate: TODAY,
    categoryName: 'Altro', sampleRow: { payee: 'Maria Bianchi', description: 'BONIFICO A FAVORE DI MARIA BIANCHI' },
  };
  const v = signalView(s, { locale: 'it', division: () => '' });
  assert.ok(!JSON.stringify(v).includes('BIANCHI'), JSON.stringify(v));
  assert.equal(v.al_mese, '150,00 €');
});

test('consigli del modello: id veri, al massimo tre, testo scartato se inventa numeri', () => {
  const views = [{ id: 'x', al_mese: '12,99 €' }, { id: 'y', al_mese: '40,00 €' }];
  const out = readAdvice({
    consigli: [
      { id: 'x', titolo: 'Netflix', perche: 'Costa 12,99 € al mese, in 12 mesi pesa.', azione: 'Valutate se lo usate.' },
      { id: 'y', titolo: 'Palestra', perche: 'Con un altro abbonamento a 25 € risparmiereste.', azione: 'Confrontate.' },
      { id: 'zzz', titolo: 'Inventato', perche: '', azione: '' },
      { id: 'x', titolo: 'Doppione', perche: '', azione: '' },
    ],
  }, views);
  assert.equal(out.length, 2);
  assert.equal(out[0].text.title, 'Netflix');
  assert.equal(out[1].text, null); // «25» non viene dal segnale
});
