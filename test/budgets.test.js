import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertToSend, budgetStatus, suggestedBudget } from '../lib/utils/budgets.js';

test('stato: speso, percentuale, livello e stima a fine mese', () => {
  const [spesa, svago] = budgetStatus(
    [{ categoryId: 'spesa', amount: 700 }, { categoryId: 'svago', amount: 100 }],
    { spesa: 600, svago: 120 },
    '2026-10-20',
  );
  assert.deepEqual(spesa, { categoryId: 'spesa', amount: 700, spent: 600, remaining: 100, pct: 86, projected: 930, level: 'warning' });
  assert.equal(svago.level, 'over');
  assert.equal(budgetStatus([{ categoryId: 'x', amount: 100 }], {}, '2026-10-03')[0].projected, null);
});

test('avvisi: la soglia più alta raggiunta, una volta al mese', () => {
  assert.equal(alertToSend(85, {}, '2026-10'), 80);
  assert.equal(alertToSend(85, { month: '2026-10', levels: [80] }, '2026-10'), null);
  assert.equal(alertToSend(130, { month: '2026-10', levels: [80] }, '2026-10'), 100);
  // Saltando l'80 si avvisa direttamente il 100, non tutti e due.
  assert.equal(alertToSend(130, {}, '2026-10'), 100);
  // Un mese nuovo riparte da zero.
  assert.equal(alertToSend(90, { month: '2026-09', levels: [80, 100] }, '2026-10'), 80);
  assert.equal(alertToSend(50, {}, '2026-10'), null);
});

test('budget suggerito: la media arrotondata alla decina sopra', () => {
  assert.equal(suggestedBudget(743.2), 750);
  assert.equal(suggestedBudget(0), null);
});
