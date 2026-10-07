import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMovementFilter } from '../lib/utils/movementFilter.js';

const filterOf = (query) => buildMovementFilter(new URLSearchParams(query));

test('categoria e ricerca insieme: valgono entrambe', () => {
  const f = filterOf('categoryIds=a,b&search=esselunga');
  assert.equal(f.$or, undefined);
  assert.equal(f.$and.length, 2);
  assert.deepEqual(f.$and[0].$or[0], { categoryId: { $in: ['a', 'b'] } });
  assert.ok(f.$and[1].$or[0].payee.test('ESSELUNGA SPA'));
});

test('solo ricerca: caratteri speciali presi alla lettera', () => {
  const f = filterOf('search=a.b(c)');
  const rx = f.$and[0].$or[0].payee;
  assert.ok(rx.test('a.b(c)'));
  assert.ok(!rx.test('axb(c)'));
});

test('intervallo di date e campi semplici', () => {
  const f = filterOf('from=2026-01-01&to=2026-01-31&type=expense&paymentGroup=traditional');
  assert.deepEqual(f.date, { $gte: '2026-01-01', $lte: '2026-01-31' });
  assert.equal(f.type, 'expense');
  assert.equal(f.paymentGroup, 'traditional');
  assert.equal(f.$and, undefined);
});

test('incompleti ed esclusi dalle analisi', () => {
  const f = filterOf('incomplete=1&excludeFromAnalysis=1');
  assert.equal(f.categoryId, null);
  assert.equal(f.excludeFromAnalysis, true);
});

test('nessun parametro: nessun filtro', () => {
  assert.deepEqual(filterOf(''), {});
});
