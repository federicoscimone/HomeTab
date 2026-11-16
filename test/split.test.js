import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duplicateKey, halves, isDuplicateOf, otherPart, splitInfo, toCents, validateSplitRows } from '../lib/utils/split.js';

const G = '0b1e5f0a-8c1d-4c3e-9f2a-1d2e3f4a5b6c';
const part = (amount, original = 100, groupId = G) => ({
  amount, split: { groupId, originalAmount: original, originalDescription: 'POS ESSELUNGA', originalPayee: 'Esselunga' },
});

test('otherPart: l\'altra parte si calcola in centesimi', () => {
  assert.equal(otherPart(100, 60), 40);
  assert.equal(otherPart(0.3, 0.1), 0.2);
  assert.equal(otherPart(87.35, 12.4), 74.95);
});

test('otherPart: niente parti a zero, negative o pari al totale', () => {
  assert.equal(otherPart(100, 0), null);
  assert.equal(otherPart(100, -5), null);
  assert.equal(otherPart(100, 100), null);
  assert.equal(otherPart(100, 120), null);
  assert.equal(otherPart(100, Number.NaN), null);
});

test('halves: il centesimo dispari va alla prima parte', () => {
  assert.deepEqual(halves(100), [50, 50]);
  assert.deepEqual(halves(10.01), [5.01, 5]);
  assert.equal(toCents(halves(0.03)[0]) + toCents(halves(0.03)[1]), 3);
});

test('splitInfo: un movimento intero diventa l\'originale', () => {
  assert.deepEqual(splitInfo({ amount: 100, description: ' POS ESSELUNGA ', payee: 'Esselunga' }, G), {
    groupId: G, originalAmount: 100, originalDescription: 'POS ESSELUNGA', originalPayee: 'Esselunga',
  });
});

test('splitInfo: dividere di nuovo una parte conserva l\'originale della banca', () => {
  const info = splitInfo({ amount: 60, description: 'spesa casa', split: part(60).split }, 'altro-gruppo');
  assert.equal(info.groupId, G);
  assert.equal(info.originalAmount, 100);
  assert.equal(info.originalDescription, 'POS ESSELUNGA');
});

test('validateSplitRows: parti che sommano all\'originale', () => {
  assert.equal(validateSplitRows([part(60), part(40), { amount: 12 }]), null);
  assert.equal(validateSplitRows([part(0.1, 0.3), part(0.2, 0.3)]), null);
  assert.equal(validateSplitRows([{ amount: 5 }]), null);
});

test('validateSplitRows: somma diversa, parte sola o dati non validi', () => {
  assert.equal(validateSplitRows([part(60), part(39.99)]), 'splitSumMismatch');
  assert.equal(validateSplitRows([part(100)]), 'invalidSplit');
  assert.equal(validateSplitRows([part(60), { ...part(40), split: { ...part(40).split, originalAmount: 90 } }]), 'invalidSplit');
  assert.equal(validateSplitRows([part(60, 100, 'non-un-uuid'), part(40, 100, 'non-un-uuid')]), 'invalidSplit');
  assert.equal(validateSplitRows([part(0), part(100)]), 'invalidSplit');
  assert.equal(validateSplitRows([{ amount: 5, split: 'x' }]), 'invalidSplit');
});

const bankRow = { date: '2026-11-10', amount: 100, description: 'POS ESSELUNGA', payee: 'Esselunga' };

test('isDuplicateOf: movimento intero, come prima', () => {
  assert.equal(isDuplicateOf(bankRow, { date: '2026-11-10', amount: 100, description: 'pos esselunga' }), true);
  assert.equal(isDuplicateOf(bankRow, { date: '2026-11-10', amount: 100.001, payee: 'Esselunga' }), true);
  assert.equal(isDuplicateOf(bankRow, { date: '2026-11-11', amount: 100, payee: 'Esselunga' }), false);
  assert.equal(isDuplicateOf(bankRow, { date: '2026-11-10', amount: 99, payee: 'Esselunga' }), false);
  assert.equal(isDuplicateOf({ ...bankRow, description: '', payee: '' }, { date: '2026-11-10', amount: 100 }), false);
});

test('isDuplicateOf: una parte riconosce la riga intera della banca', () => {
  const stored = { date: '2026-11-10', amount: 60, description: 'spesa casa', payee: 'Esselunga', ...part(60) };
  assert.equal(isDuplicateOf(bankRow, stored), true);
  // anche se l'utente ha cambiato descrizione ed esercente della parte
  assert.equal(isDuplicateOf(bankRow, { ...stored, description: 'detersivi', payee: '' }), true);
  // una riga da 60 non è la parte da 60: la banca non riporta le parti
  assert.equal(isDuplicateOf({ ...bankRow, amount: 60, description: 'altro', payee: 'altro' }, stored), false);
});

test('duplicateKey: una parte si confronta con il suo originale', () => {
  assert.deepEqual(duplicateKey({ date: '2026-11-10', amount: 60, description: 'casa', payee: '', ...part(60) }), {
    date: '2026-11-10', amount: 100, description: 'POS ESSELUNGA', payee: 'Esselunga',
  });
  assert.deepEqual(duplicateKey(bankRow), bankRow);
});

test('newGroupId: un UUID v4 valido, diverso a ogni chiamata', async () => {
  const { newGroupId } = await import('../lib/utils/split.js');
  const a = newGroupId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, newGroupId());
  assert.equal(validateSplitRows([part(60, 100, a), part(40, 100, a)]), null);
});

test('setPartAmount: l\'altra parte assorbe la differenza, il totale resta', async () => {
  const { setPartAmount } = await import('../lib/utils/split.js');
  const rows = [{ amount: 5 }, part(50), part(50), { amount: 7 }];
  const after = setPartAmount(rows, 1, 62.5);
  assert.deepEqual(after.map((r) => r.amount), [5, 62.5, 37.5, 7]);
  // l'ultima parte modificata scarica sulla precedente
  assert.deepEqual(setPartAmount(rows, 2, 10).map((r) => r.amount), [5, 90, 10, 7]);
  // tre parti: la terza resta ferma
  const three = [part(50), part(30), part(20)];
  assert.deepEqual(setPartAmount(three, 0, 40).map((r) => r.amount), [40, 40, 20]);
});

test('setPartAmount: rifiuta zero, negativi e importi che azzerano l\'altra parte', async () => {
  const { setPartAmount } = await import('../lib/utils/split.js');
  const rows = [part(50), part(50)];
  assert.equal(setPartAmount(rows, 0, 0), null);
  assert.equal(setPartAmount(rows, 0, 100), null);
  assert.equal(setPartAmount(rows, 0, 120), null);
  assert.equal(setPartAmount([{ amount: 5 }], 0, 3), null);
});
