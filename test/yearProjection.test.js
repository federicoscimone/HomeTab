import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectYear } from '../lib/utils/yearProjection.js';

/** Mille euro a metà di ogni mese da gennaio a `lastMonth`, più eventuali movimenti extra. */
const monthly = (year, lastMonth, extra = []) => [
  ...Array.from({ length: lastMonth }, (_, i) => ({ date: `${year}-${String(i + 1).padStart(2, '0')}-15`, amount: 1000 })),
  ...extra,
];

test('media sui soli mesi chiusi: il mese in corso conta nello speso, non nella media', () => {
  const p = projectYear(monthly(2026, 9, [{ date: '2026-10-01', amount: 500 }]), '2026-10-07');
  assert.equal(p.yearTotal, 9500);
  assert.equal(p.completeMonths, 9);
  assert.equal(p.avgPerMonth, 1000);
  assert.equal(p.daysLeft, 85);
  assert.ok(Math.abs(p.remaining - 1000 * 12 * 85 / 365) < 1e-9);
  assert.ok(Math.abs(p.projection - (9500 + p.remaining)) < 1e-9);
});

test('a gennaio non c\'è un mese chiuso: nessuna proiezione', () => {
  const p = projectYear([{ date: '2026-01-02', amount: 900 }], '2026-01-20');
  assert.equal(p.yearTotal, 900);
  assert.equal(p.projection, null);
  assert.equal(p.avgPerMonth, null);
});

test('il 31 dicembre la proiezione coincide con lo speso, anche negli anni bisestili', () => {
  const p = projectYear(monthly(2028, 12), '2028-12-31');
  assert.equal(p.daysLeft, 0);
  assert.equal(p.projection, 12000);
});

test('una spesa grossa nel mese in corso sposta la proiezione', () => {
  const base = projectYear(monthly(2026, 9), '2026-10-07');
  const withCar = projectYear(monthly(2026, 9, [{ date: '2026-10-03', amount: 5000 }]), '2026-10-07');
  assert.equal(withCar.projection - base.projection, 5000);
});
