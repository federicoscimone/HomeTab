import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movementInput, movementPatchInput } from '../lib/utils/movementInput.js';

const VALID = { amount: 12.5, paymentMethod: 'cash', date: '2026-10-07' };
const ID = '0123456789abcdef01234567';

test('un movimento minimo riceve i valori predefiniti', () => {
  const { data, error } = movementInput(VALID);
  assert.equal(error, undefined);
  assert.equal(data.type, 'expense');
  assert.equal(data.paymentGroup, 'traditional');
  assert.equal(data.time, null);
  assert.equal(data.description, '');
  assert.equal(data.categoryId, null);
  assert.equal(data.excludeFromAnalysis, false);
});

test('i campi fuori elenco vengono ignorati', () => {
  const { data } = movementInput({ ...VALID, source: 'import', importBatchId: 'x', _id: ID, paymentGroup: 'alternative' });
  assert.equal(data.source, undefined);
  assert.equal(data.importBatchId, undefined);
  assert.equal(data._id, undefined);
  // Il gruppo deriva sempre dal metodo, non da quello che manda il client.
  assert.equal(data.paymentGroup, 'traditional');
});

test('importo, metodo, data, ora e tipo non validi', () => {
  assert.equal(movementInput({ ...VALID, amount: 0 }).error, 'invalidAmount');
  assert.equal(movementInput({ ...VALID, amount: '12,5' }).error, 'invalidAmount');
  assert.equal(movementInput({ ...VALID, paymentMethod: 'bitcoin' }).error, 'invalidPaymentMethod');
  assert.equal(movementInput({ ...VALID, date: '07/10/2026' }).error, 'invalidDate');
  assert.equal(movementInput({ ...VALID, time: '25:00' }).error, 'invalidTime');
  assert.equal(movementInput({ ...VALID, type: 'transfer' }).error, 'invalidType');
  assert.equal(movementInput({ ...VALID, notes: 'x'.repeat(1001) }).error, 'textTooLong');
  assert.equal(movementInput(null).error, 'invalidMovement');
  assert.equal(movementInput({ ...VALID, payee: { $gt: '' } }).error, 'invalidMovement');
});

test('importo come stringa numerica e riferimenti vuoti', () => {
  const { data } = movementInput({ ...VALID, amount: '19.90', categoryId: ID, subCategory1Id: '', goalId: 'non-un-id' });
  assert.equal(data.amount, 19.9);
  assert.equal(data.categoryId, ID);
  assert.equal(data.subCategory1Id, null);
  assert.equal(data.goalId, null);
});

test('un obiettivo si collega solo a un\'uscita tradizionale', () => {
  assert.equal(movementInput({ ...VALID, goalId: ID }).data.goalId, ID);
  assert.equal(movementInput({ ...VALID, goalId: ID, type: 'income' }).data.goalId, null);
  assert.equal(movementInput({ ...VALID, goalId: ID, paymentMethod: 'meal_ticket' }).data.goalId, null);
});

test('il PATCH accetta solo excludeFromAnalysis booleano', () => {
  assert.deepEqual(movementPatchInput({ excludeFromAnalysis: true }).data, { excludeFromAnalysis: true });
  assert.equal(movementPatchInput({ excludeFromAnalysis: 'true' }).error, 'invalidPatch');
  assert.equal(movementPatchInput({ excludeFromAnalysis: true, amount: 1 }).error, 'invalidPatch');
  assert.equal(movementPatchInput({ amount: 1 }).error, 'invalidPatch');
  assert.equal(movementPatchInput([]).error, 'invalidPatch');
});

test('pick tiene solo i campi ammessi', async () => {
  const { pick, isInputError } = await import('../lib/utils/apiInput.js');
  assert.deepEqual(pick({ name: 'Casa', _id: 'x', color: undefined }, ['name', 'color']), { name: 'Casa' });
  assert.deepEqual(pick(null, ['name']), {});
  assert.deepEqual(pick(['name'], ['0']), {});
  assert.equal(isInputError({ name: 'ValidationError' }), true);
  assert.equal(isInputError(new Error('boom')), false);
});
