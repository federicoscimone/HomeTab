/**
 * Test della logica degli obiettivi. Eseguire con `npm test` (node:test, nessuna dipendenza).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths, monthDiff, allocate, averageSavings, projectGoal, suggestShares, computeGoals,
} from '../lib/utils/goalMath.js';

/** Obiettivo attivo con valori di default sensati, sovrascrivibili. */
const goal = (id, extra = {}) => ({
  id, name: id, targetAmount: 10000, deadline: '2027-12', initialAmount: 0,
  createdMonth: '2026-01', status: 'active', closedMonth: null, transferTo: null, ...extra,
});

/** Risparmio costante per i mesi da `from` a `to` inclusi. */
const flat = (from, to, amount) => {
  const out = {};
  for (let m = from; m <= to; m = addMonths(m, 1)) out[m] = amount;
  return out;
};

/** Σ disponibile + libero deve sempre valere Σ iniziali + Σ risparmi − Σ spese collegate. */
function assertBooksBalance(input, result) {
  const goalsTotal = Object.values(result.goals).reduce((s, g) => s + g.available, 0);
  const initial = input.goals.reduce((s, g) => s + g.initialAmount, 0);
  const savings = Object.entries(input.savingsByMonth)
    .filter(([m]) => m < input.currentMonth)
    .reduce((s, [, v]) => s + v, 0);
  const linked = input.linkedExpenses.reduce((s, e) => s + e.amount, 0);
  assert.ok(Math.abs(goalsTotal + result.free - (initial + savings - linked)) < 0.01,
    `bilancio non quadra: obiettivi ${goalsTotal} + libero ${result.free} ≠ ${initial + savings - linked}`);
}

test('aritmetica dei mesi', () => {
  assert.equal(addMonths('2026-11', 3), '2027-02');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(monthDiff('2026-10', '2027-08'), 10);
  assert.equal(monthDiff('2026-10', '2026-10'), 0);
});

test('ripartisce i mesi chiusi secondo le percentuali, il resto va nel libero', () => {
  const input = {
    goals: [goal('a'), goal('b')],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 50 }, { goalId: 'b', pct: 30 }] }],
    savingsByMonth: flat('2026-01', '2026-03', 1000),
    linkedExpenses: [],
    currentMonth: '2026-04',
  };
  const r = allocate(input);
  assert.equal(r.goals.a.saved, 1500);
  assert.equal(r.goals.b.saved, 900);
  assert.equal(r.free, 600);
  assertBooksBalance(input, r);
});

test('il mese in corso non viene ripartito', () => {
  const input = {
    goals: [goal('a')],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 100 }] }],
    savingsByMonth: { '2026-01': 1000, '2026-02': 999 },
    linkedExpenses: [],
    currentMonth: '2026-02',
  };
  assert.equal(allocate(input).goals.a.saved, 1000);
});

test('cambiare piano non riscrive i mesi già ripartiti', () => {
  const input = {
    goals: [goal('a'), goal('b')],
    plans: [
      { effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 50 }, { goalId: 'b', pct: 50 }] },
      { effectiveFrom: '2026-03', shares: [{ goalId: 'a', pct: 70 }, { goalId: 'b', pct: 30 }] },
    ],
    savingsByMonth: flat('2026-01', '2026-03', 1000),
    linkedExpenses: [],
    currentMonth: '2026-04',
  };
  const r = allocate(input);
  assert.equal(r.goals.a.saved, 500 + 500 + 700);
  assert.equal(r.goals.b.saved, 500 + 500 + 300);
});

test('un mese negativo fa scendere gli obiettivi in proporzione', () => {
  const input = {
    goals: [goal('a'), goal('b')],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 60 }, { goalId: 'b', pct: 40 }] }],
    savingsByMonth: { '2026-01': 1000, '2026-02': -500 },
    linkedExpenses: [],
    currentMonth: '2026-03',
  };
  const r = allocate(input);
  assert.equal(r.goals.a.saved, 600 - 300);
  assert.equal(r.goals.b.saved, 400 - 200);
  assertBooksBalance(input, r);
});

test('un obiettivo raggiunto smette di ricevere quote e non scende più', () => {
  const input = {
    goals: [goal('a', { targetAmount: 1200 })],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 100 }] }],
    savingsByMonth: { '2026-01': 1000, '2026-02': 1000, '2026-03': -400 },
    linkedExpenses: [],
    currentMonth: '2026-04',
  };
  const r = allocate(input);
  assert.equal(r.goals.a.saved, 1200, 'la quota si ferma all\'importo');
  assert.equal(r.goals.a.reachedMonth, '2026-02');
  assert.equal(r.free, 800 - 400, 'eccedenza e mese negativo restano nel libero');
  assertBooksBalance(input, r);
});

test('il già accantonato conta dal mese di creazione e un obiettivo nuovo non riceve mesi precedenti', () => {
  const input = {
    goals: [goal('a'), goal('b', { createdMonth: '2026-03', initialAmount: 2000 })],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 50 }, { goalId: 'b', pct: 50 }] }],
    savingsByMonth: flat('2026-01', '2026-03', 1000),
    linkedExpenses: [],
    currentMonth: '2026-04',
  };
  const r = allocate(input);
  assert.equal(r.goals.b.saved, 2000 + 500);
  assert.equal(r.goals.b.series[0].month, '2026-03');
  assertBooksBalance(input, r);
});

test('le spese collegate scalano il disponibile ma non l\'accantonato', () => {
  const input = {
    goals: [goal('a', { targetAmount: 3000 })],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 100 }] }],
    savingsByMonth: flat('2026-01', '2026-02', 1000),
    linkedExpenses: [{ goalId: 'a', month: '2026-02', amount: 400 }],
    currentMonth: '2026-03',
  };
  const r = allocate(input);
  assert.equal(r.goals.a.saved, 2000);
  assert.equal(r.goals.a.available, 1600);
  assertBooksBalance(input, r);
});

test('un obiettivo concluso restituisce l\'avanzo al libero, anche se ha speso più del previsto', () => {
  const input = {
    goals: [
      goal('viaggio', { targetAmount: 2000, status: 'completed', closedMonth: '2026-03' }),
    ],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'viaggio', pct: 100 }] }],
    savingsByMonth: flat('2026-01', '2026-03', 1000),
    linkedExpenses: [
      { goalId: 'viaggio', month: '2026-02', amount: 2300 },
      { goalId: 'viaggio', month: '2026-03', amount: 100 }, // spesa dopo la chiusura
    ],
    currentMonth: '2026-04',
  };
  const r = allocate(input);
  assert.equal(r.goals.viaggio.available, 0);
  // Gen+Feb → 2000 all'obiettivo, spesi 2300: alla chiusura il -300 passa al libero.
  // Marzo (chiusura) → 1000 al libero; la spesa di marzo dopo la chiusura → -100.
  assert.equal(r.free, -300 + 1000 - 100);
  assertBooksBalance(input, r);
});

test('un obiettivo annullato può girare il disponibile a un altro obiettivo', () => {
  const input = {
    goals: [
      goal('a', { status: 'cancelled', closedMonth: '2026-03', transferTo: 'b' }),
      goal('b'),
    ],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 50 }, { goalId: 'b', pct: 50 }] }],
    savingsByMonth: flat('2026-01', '2026-03', 1000),
    linkedExpenses: [],
    currentMonth: '2026-04',
  };
  const r = allocate(input);
  assert.equal(r.goals.a.available, 0);
  assert.equal(r.goals.b.saved, 500 + 500 + 1000 + 500);
  assert.equal(r.free, 500, 'la quota di marzo di a, già chiuso, va nel libero');
  assertBooksBalance(input, r);
});

test('la media usa solo mesi chiusi con dati, al massimo `window`', () => {
  const s = { '2026-07': 1000, '2026-08': 2000, '2026-09': 3000 };
  assert.deepEqual(averageSavings(s, '2026-10', '2026-07', 6), { avg: 2000, months: 3 });
  assert.deepEqual(averageSavings(s, '2026-10', '2026-07', 2), { avg: 2500, months: 2 });
  assert.deepEqual(averageSavings(s, '2026-07', '2026-07', 6), { avg: null, months: 0 });
});

test('proiezione: quota attesa, mese stimato e fabbisogno', () => {
  const p = projectGoal({
    saved: 1000, target: 4000, deadline: '2027-03', currentMonth: '2026-10', avgSavings: 1000, pct: 50,
  });
  assert.equal(p.monthsLeft, 6);            // ott → mar inclusi
  assert.equal(p.requiredMonthly, 500);
  assert.equal(p.expectedQuota, 500);
  assert.equal(p.projectedAtDeadline, 4000);
  assert.equal(p.reachMonth, '2027-03');
  assert.equal(p.series.length, 6);
});

test('suggerimento: 100% con un solo obiettivo', () => {
  const s = suggestShares([{ goalId: 'a', requiredMonthly: 300 }], 1000);
  assert.deepEqual(s, { shares: [{ goalId: 'a', pct: 100 }], feasible: true });
});

test('suggerimento: in base al fabbisogno, scalato se non basta', () => {
  const ok = suggestShares([{ goalId: 'a', requiredMonthly: 300 }, { goalId: 'b', requiredMonthly: 200 }], 1000);
  assert.deepEqual(ok.shares.map((s) => s.pct), [30, 20]);
  assert.equal(ok.feasible, true);

  const ko = suggestShares([{ goalId: 'a', requiredMonthly: 900 }, { goalId: 'b', requiredMonthly: 600 }], 1000);
  assert.deepEqual(ko.shares.map((s) => s.pct), [60, 40]);
  assert.equal(ko.feasible, false);
});

test('computeGoals segnala gli obiettivi attivi senza quota nel piano', () => {
  const r = computeGoals({
    goals: [goal('a'), goal('b', { createdMonth: '2026-10' })],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 100 }] }],
    savingsByMonth: flat('2026-01', '2026-09', 1000),
    linkedExpenses: [],
    currentMonth: '2026-10',
    firstDataMonth: '2026-01',
  });
  assert.equal(r.planNeedsUpdate, true);
  assert.deepEqual(r.missingFromPlan, ['b']);
  assert.equal(r.goals.find((g) => g.id === 'a').state, 'on_track');
});

test('computeGoals: stato "behind" quando la quota non basta', () => {
  const r = computeGoals({
    goals: [goal('a', { targetAmount: 50000, deadline: '2027-01' })],
    plans: [{ effectiveFrom: '2026-01', shares: [{ goalId: 'a', pct: 100 }] }],
    savingsByMonth: flat('2026-01', '2026-09', 1000),
    linkedExpenses: [],
    currentMonth: '2026-10',
    firstDataMonth: '2026-01',
  });
  const a = r.goals[0];
  assert.equal(a.state, 'behind');
  assert.equal(r.feasible, false);
});
