import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectSavings } from '../lib/utils/savingsProjection.js';

/** Un anno di mesi uguali, con la tredicesima a dicembre e le vacanze ad agosto. */
function year(y, { income = 3000, expense = 2500, scale = 1 } = {}) {
  const out = {};
  for (let m = 1; m <= 12; m += 1) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out[k] = { income: (m === 12 ? income * 2 : income) * scale, expense: (m === 8 ? expense + 1000 : expense) * scale };
  }
  return out;
}

test('stagionale: la tredicesima e le vacanze dell\'anno scorso entrano nei mesi che mancano', () => {
  const data = { ...year(2025), ...year(2026) };
  // Ottobre in corso: registrato solo un pezzo, le stime prendono il mese intero.
  data['2026-10'] = { income: 0, expense: 800 };
  for (const m of ['11', '12']) delete data[`2026-${m}`];
  const p = projectSavings(data, '2026-10-21', '2025-01');
  assert.equal(p.method, 'seasonal');
  assert.equal(p.actual.savings, 27000 - 23500 - 800); // 9 mesi chiusi + ottobre finora
  // Uguale all'anno scorso: stesso andamento, stessa tredicesima.
  assert.deepEqual(p.projected, { income: 39000, expense: 31000, savings: 8000 });
  assert.deepEqual(p.lastYear, { income: 39000, expense: 31000, savings: 8000 });
  assert.equal(p.months[9].kind, 'current');
  assert.equal(p.months[11].savings, 3500);
});

test('quest\'anno va meglio del 10%: i mesi che mancano crescono nella stessa misura', () => {
  const data = { ...year(2025), ...year(2026, { scale: 1.1 }) };
  for (const m of ['10', '11', '12']) delete data[`2026-${m}`];
  const p = projectSavings(data, '2026-10-01', '2025-01');
  assert.equal(p.projected.income, 39000 * 1.1);
});

test('senza l\'anno scorso: media dei mesi chiusi', () => {
  const data = year(2026);
  for (const m of ['10', '11', '12']) delete data[`2026-${m}`];
  const p = projectSavings(data, '2026-10-15', '2026-01');
  assert.equal(p.method, 'average');
  assert.equal(p.lastYear, null);
  // Media dei 9 mesi chiusi (ago compreso) per i 3 che mancano.
  const avgExpense = (2500 * 9 + 1000) / 9;
  assert.equal(p.projected.expense, Math.round((2500 * 9 + 1000 + avgExpense * 3) * 100) / 100);
});

test('a gennaio senza storico non c\'è proiezione', () => {
  assert.equal(projectSavings({ '2026-01': { income: 100, expense: 50 } }, '2026-01-10', '2026-01'), null);
});

test('il mese in corso conta almeno quanto già registrato', () => {
  const data = { ...year(2025) };
  data['2026-01'] = { income: 9000, expense: 100 }; // un bonus già arrivato
  const p = projectSavings(data, '2026-01-20', '2025-01');
  assert.equal(p.months[0].savings, 9000 - 2500);
});

test('un\'entrata una tantum pesa una volta sola; un aumento di stipendio sposta i mesi che mancano', () => {
  // 25.000 € a marzo: prima il rapporto dei totali saliva a 1,6 e gonfiava ottobre-dicembre.
  const once = { ...year(2025), ...year(2026) };
  once['2026-03'] = { income: 3000 + 25000, expense: 2500 };
  for (const m of ['10', '11', '12']) delete once[`2026-${m}`];
  const p = projectSavings(once, '2026-10-01', '2025-01');
  assert.equal(p.projected.income, 39000 + 25000);
  assert.equal(p.projected.savings, 8000 + 25000);

  // Da marzo lo stipendio sale del 20%: sette mesi chiusi su nove, la mediana lo vede.
  const raise = { ...year(2025), ...year(2026) };
  for (let m = 3; m <= 9; m += 1) raise[`2026-${String(m).padStart(2, '0')}`].income = 3600;
  for (const m of ['10', '11', '12']) delete raise[`2026-${m}`];
  const r = projectSavings(raise, '2026-10-01', '2025-01');
  assert.equal(r.projected.income, 3000 * 2 + 3600 * 7 + (3000 + 3000 + 6000) * 1.2);
});
