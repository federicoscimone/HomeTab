import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectBreakdown, tasksSummary } from '../lib/utils/project.js';

test('voci: speso per voce, voce che sfora, preventivo sopra il budget, spese senza voce', () => {
  const items = [
    { _id: 'a', name: 'Piastrelle', budget: 2000, quote: 2300 },
    { _id: 'b', name: 'Idraulico', budget: 1500 },
  ];
  const r = projectBreakdown(items, [
    { amount: 1200, goalItemId: 'a' }, { amount: 900, goalItemId: 'a' },
    { amount: 400, goalItemId: 'b' },
    { amount: 150 }, { amount: 50, goalItemId: 'eliminata' },
  ]);
  assert.deepEqual(r.rows[0], { id: 'a', name: 'Piastrelle', budget: 2000, quote: 2300, spent: 2100, remaining: -100, over: true, quoteOver: true });
  assert.equal(r.rows[1].over, false);
  assert.equal(r.unassigned, 200);
  assert.deepEqual(r.totals, { budget: 3500, quote: 2300, spent: 2700 });
  assert.equal(r.overCount, 1);
});

test('cose da fare: fatte, in ritardo, la prossima con una data', () => {
  const s = tasksSummary([
    { text: 'Preventivo', done: true, due: '2026-09-01' },
    { text: 'Ordinare', done: false, due: '2026-10-01' },
    { text: 'Montare', done: false, due: '2026-11-15' },
    { text: 'Pulire', done: false },
  ], '2026-10-22');
  assert.equal(s.done, 1);
  assert.equal(s.overdue, 1);
  assert.equal(s.next.text, 'Ordinare');
});
