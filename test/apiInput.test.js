import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pagination } from '../lib/utils/apiInput.js';

const params = (query) => new URLSearchParams(query);

test('la paginazione usa i valori predefiniti quando mancano o non sono numeri', () => {
  assert.deepEqual(pagination(params(''), 20), { page: 1, limit: 20 });
  assert.deepEqual(pagination(params('page=abc&limit=abc'), 20), { page: 1, limit: 20 });
});

test('la paginazione resta fra 1 e 100 elementi, dalla pagina 1 in poi', () => {
  assert.deepEqual(pagination(params('page=3&limit=50'), 20), { page: 3, limit: 50 });
  assert.deepEqual(pagination(params('page=-2&limit=-5'), 20), { page: 1, limit: 1 });
  assert.deepEqual(pagination(params('limit=0'), 20), { page: 1, limit: 20 });
  assert.deepEqual(pagination(params('limit=5000'), 20), { page: 1, limit: 100 });
});
