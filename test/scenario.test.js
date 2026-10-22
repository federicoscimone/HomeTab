import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalReach, monthlyDeltas, simulate } from '../lib/utils/scenario.js';

const ctx = { start: '2026-10', horizon: 6, categoryAvg: { ristoranti: 200 } };

test('scarti mese per mese: entrate, categoria in percentuale, una tantum, rata', () => {
  assert.deepEqual(monthlyDeltas([{ type: 'income', amount: -600, from: '2027-01' }], ctx), [0, 0, 0, -600, -600, -600]);
  assert.deepEqual(monthlyDeltas([{ type: 'category', categoryId: 'ristoranti', percent: -30 }], ctx), [60, 60, 60, 60, 60, 60]);
  assert.deepEqual(monthlyDeltas([{ type: 'oneOff', amount: 1500, from: '2026-12' }], ctx), [0, 0, -1500, 0, 0, 0]);
  assert.deepEqual(monthlyDeltas([{ type: 'installment', amount: 300, from: '2026-11', months: 2 }], ctx), [0, -300, -300, 0, 0, 0]);
  assert.deepEqual(monthlyDeltas([{ type: 'oneOff', amount: 500, income: true, from: '2026-10' }], ctx), [500, 0, 0, 0, 0, 0]);
});

test('obiettivo: arriva quando la sua quota accumulata tocca il traguardo; un mese negativo non toglie', () => {
  const monthly = (i) => (i === 1 ? -1000 : 1000);
  // 50% di 1000 al mese, 0 nel mese negativo: 0 + 500 + 0 + 500 → al mese 2 (indice) arriva a 1000.
  assert.equal(goalReach({ saved: 0, target: 1000, pct: 50, monthly, start: '2026-10' }), '2026-12');
  assert.equal(goalReach({ saved: 0, target: 1000, pct: 0, monthly, start: '2026-10' }), null);
  assert.equal(goalReach({ saved: 1000, target: 1000, pct: 50, monthly, start: '2026-10' }), '2026-10');
});

test('confronto: la rata dell\'auto sposta il risparmio di fine anno e l\'arrivo dell\'obiettivo', () => {
  const r = simulate({
    changes: [{ type: 'installment', amount: 300, from: '2026-11', months: 48 }],
    start: '2026-10',
    baseThisYear: [1000, 1000, 1000],
    baseAfter: 1000,
    categoryAvg: {},
    goals: [{ name: 'Casa', saved: 0, target: 3500, pct: 50, deadline: '2027-04' }],
    yearToDate: 9000,
  });
  assert.deepEqual(r.yearEnd, { before: 12000, after: 11400 });
  assert.deepEqual(r.next12, { before: 12000, after: 8700 });
  // 500 al mese → 7 mesi (2027-04); con la rata 350 dal secondo mese → 500 + 350×9 ≥ 3500 al decimo.
  assert.deepEqual(r.goals[0], {
    name: 'Casa', deadline: '2027-04', before: '2027-04', after: '2027-07', shift: 3, onTimeBefore: true, onTimeAfter: false,
  });
});
