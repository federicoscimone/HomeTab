import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryCodes, dedupeRows, readSuggestions, rowText, MIN_CONFIDENCE } from '../lib/ai/tasks/categorize.js';

const CATS = [
  { _id: 'a', name: 'Spesa', level: 1 },
  { _id: 'b', name: 'Casa', level: 1 },
  { _id: 'a1', name: 'Supermercato', level: 2, parentId: 'a' },
  { _id: 'b1', name: 'Bollette', level: 2, parentId: 'b' },
  { _id: 'x', name: 'Livello 3', level: 3, parentId: 'a1' },
];

test('codici brevi per categorie e sottocategorie, e ritorno agli id', () => {
  const { list, byCode, codeOf } = categoryCodes(CATS);
  assert.deepEqual(list, [
    { code: 'c1', name: 'Spesa', parent: null },
    { code: 'c1.1', name: 'Supermercato', parent: 'c1' },
    { code: 'c2', name: 'Casa', parent: null },
    { code: 'c2.1', name: 'Bollette', parent: 'c2' },
  ]);
  assert.deepEqual(byCode.get('c2.1'), { categoryId: 'b', subCategory1Id: 'b1' });
  assert.deepEqual(byCode.get('c1'), { categoryId: 'a', subCategory1Id: null });
  assert.equal(codeOf('a', 'a1'), 'c1.1');
  assert.equal(codeOf('a', null), 'c1');
  assert.equal(codeOf('sconosciuta', null), null);
});

test('il testo inviato è mascherato e le righe uguali partono una volta', () => {
  assert.equal(rowText({ description: 'PAGAMENTO POS CARTA 782872', payee: 'ESSELUNGA', place: '' }), 'PAGAMENTO POS CARTA [NUM] | ESSELUNGA');
  const { items, members } = dedupeRows([
    { id: 0, description: 'POS', payee: 'ESSELUNGA', type: 'expense', amount: 10 },
    { id: 1, description: 'pos', payee: 'Esselunga', type: 'expense', amount: 55.555 },
    { id: 2, description: 'POS', payee: 'ESSELUNGA', type: 'income', amount: 3 },
    { id: 3, description: '', payee: '', place: '' },
  ]);
  assert.equal(items.length, 2);
  assert.deepEqual(members.get(0), [0, 1]);
  assert.deepEqual(members.get(1), [2]);
  assert.equal(items[0].amount, 10);
});

test('la risposta del modello: codici inventati, confidenza bassa e segnaposto vengono scartati', () => {
  const { byCode } = categoryCodes(CATS);
  const groups = dedupeRows([
    { id: 10, payee: 'ESSELUNGA', type: 'expense' },
    { id: 11, payee: 'esselunga', type: 'expense' },
    { id: 12, payee: 'ENEL', type: 'expense' },
    { id: 13, payee: 'BOH', type: 'expense' },
  ]);
  const out = readSuggestions({ rows: [
    { id: 0, category: 'c1.1', confidence: 0.92, merchant: 'Esselunga', place: 'Milano' },
    { id: 1, category: 'c9', confidence: 0.99, merchant: '[NOME]', place: null },
    { id: 2, category: 'c2', confidence: MIN_CONFIDENCE - 0.01, merchant: null, place: null },
    { id: 0, category: 'c2', confidence: 1, merchant: null, place: null },
    { id: 99, category: 'c1', confidence: 1, merchant: null, place: null },
  ] }, groups, byCode);
  assert.deepEqual(out, [
    { id: 10, categoryId: 'a', subCategory1Id: 'a1', confidence: 0.92, merchant: 'Esselunga', place: 'Milano' },
    { id: 11, categoryId: 'a', subCategory1Id: 'a1', confidence: 0.92, merchant: 'Esselunga', place: 'Milano' },
  ]);
  assert.deepEqual(readSuggestions(null, groups, byCode), []);
});
