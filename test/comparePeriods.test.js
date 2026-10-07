import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonPeriods, sameDayPreviousYear, todayString } from '../lib/utils/comparePeriods.js';

test('anno in corso: periodo troncato a oggi, due basi di confronto', () => {
  const p = comparisonPeriods(2026, null, '2026-10-07');
  assert.deepEqual(p.current, { from: '2026-01-01', to: '2026-10-07' });
  assert.deepEqual(p.previousToDate, { from: '2025-01-01', to: '2025-10-07' });
  assert.deepEqual(p.previousFull, { from: '2025-01-01', to: '2025-12-31' });
  assert.equal(p.cutoff, '2026-10-07');
});

test('anno concluso: le due basi coincidono e non c\'è data di taglio', () => {
  const p = comparisonPeriods(2025, null, '2026-10-07');
  assert.deepEqual(p.current, { from: '2025-01-01', to: '2025-12-31' });
  assert.deepEqual(p.previousToDate, p.previousFull);
  assert.equal(p.cutoff, null);
});

test('mese in corso: stesso mese dell\'anno prima fino allo stesso giorno', () => {
  const p = comparisonPeriods(2026, 10, '2026-10-07');
  assert.deepEqual(p.current, { from: '2026-10-01', to: '2026-10-07' });
  assert.deepEqual(p.previousToDate, { from: '2025-10-01', to: '2025-10-07' });
  assert.deepEqual(p.previousFull, { from: '2025-10-01', to: '2025-10-31' });
});

test('mese di un anno in corso ma già concluso: nessun taglio', () => {
  const p = comparisonPeriods(2026, 9, '2026-10-07');
  assert.equal(p.cutoff, null);
  assert.deepEqual(p.current, { from: '2026-09-01', to: '2026-09-31' });
});

test('29 febbraio: l\'anno prima diventa il 28', () => {
  assert.equal(sameDayPreviousYear('2028-02-29'), '2027-02-28');
  assert.equal(sameDayPreviousYear('2026-03-01'), '2025-03-01');
});

test('todayString usa la data locale con zeri iniziali', () => {
  assert.equal(todayString(new Date(2026, 0, 5)), '2026-01-05');
});
