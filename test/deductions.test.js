import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDeduction, movementDeduction, summarizeDeductions, traceability } from '../lib/utils/deductions.js';

const byId = new Map([
  ['salute', { deduction: 'health' }], ['farmacia', { deduction: null }],
  ['animali', { deduction: null }], ['vet', { deduction: 'vet' }], ['spesa', { deduction: null }],
]);

test('tipo del movimento: la sua scelta, poi la categoria più specifica', () => {
  assert.equal(movementDeduction(byId, { categoryId: 'salute', subCategory1Id: 'farmacia' }), 'health');
  assert.equal(movementDeduction(byId, { categoryId: 'animali', subCategory1Id: 'vet' }), 'vet');
  assert.equal(movementDeduction(byId, { categoryId: 'animali' }), null);
  assert.equal(movementDeduction(byId, { categoryId: 'salute', deduction: 'none' }), null);
  assert.equal(movementDeduction(byId, { categoryId: 'spesa', deduction: 'other' }), 'other');
});

test('tracciabilità: contanti sanitari da verificare, altri esclusi', () => {
  assert.equal(traceability('health', 'debit_card'), 'ok');
  assert.equal(traceability('health', 'cash'), 'check');
  assert.equal(traceability('vet', 'cash'), 'cash');
  assert.equal(traceability('vet', 'bank_transfer'), 'ok');
});

test('totali per tipo: i contanti non sanitari restano fuori', () => {
  const r = summarizeDeductions([
    { date: '2025-03-01', amount: 80, paymentMethod: 'debit_card', categoryId: 'salute' },
    { date: '2025-02-01', amount: 30, paymentMethod: 'cash', categoryId: 'salute' },
    { date: '2025-04-01', amount: 120, paymentMethod: 'cash', categoryId: 'animali', subCategory1Id: 'vet' },
    { date: '2025-05-01', amount: 60, paymentMethod: 'credit_card', categoryId: 'spesa' },
  ], byId);
  assert.deepEqual(r.types, [
    { type: 'health', count: 2, total: 110, toCheck: 30, excludedCash: 0 },
    { type: 'vet', count: 1, total: 0, toCheck: 0, excludedCash: 120 },
  ]);
  assert.deepEqual(r.rows.map((x) => x.date), ['2025-02-01', '2025-03-01', '2025-04-01']);
});

test('predefiniti del seed', () => {
  assert.equal(defaultDeduction('Salute'), 'health');
  assert.equal(defaultDeduction('Animali', 'Veterinario'), 'vet');
  assert.equal(defaultDeduction('Animali', 'Cibo'), null);
});
