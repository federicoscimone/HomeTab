/**
 * @fileoverview Proiezione delle uscite a fine anno.
 * @module lib/utils/yearProjection
 *
 * Proiezione = quanto speso davvero finora + la media dei mesi chiusi per la parte d'anno che
 * manca. La media usa solo i mesi chiusi perché un mese in corso conterebbe intero con pochi
 * giorni di spese: la versione precedente divideva per il numero del mese, e al 7 ottobre
 * divideva per 10 mesi invece che per 9,2, sottostimando la media e la proiezione.
 * La parte che manca si misura in giorni, così la stima scende con continuità fino al 31
 * dicembre, quando coincide con lo speso.
 *
 * A gennaio non c'è ancora un mese chiuso: la proiezione è null, non un numero inventato.
 */

const DAY_MS = 86_400_000;

/**
 * @typedef {Object} YearProjection
 * @property {number}      yearTotal      - Speso dal 1° gennaio a oggi.
 * @property {number}      completeMonths - Mesi chiusi su cui si calcola la media (0 a gennaio).
 * @property {number}      daysLeft       - Giorni dell'anno dopo oggi.
 * @property {number|null} avgPerMonth    - Media dei mesi chiusi.
 * @property {number|null} remaining      - Stima per i giorni che mancano.
 * @property {number|null} projection     - yearTotal + remaining.
 */

/**
 * @param {Array<{ date: string, amount: number }>} movements - Movimenti dell'anno in corso fino
 *   a oggi; date YYYY-MM-DD come nei movimenti.
 * @param {string} today - YYYY-MM-DD.
 * @returns {YearProjection}
 *
 * @example
 * // Mille euro al mese da gennaio a settembre, 500 nei primi giorni di ottobre:
 * projectYear(movements, '2026-10-07').projection // 9500 + 1000 × 12 × 85/365 ≈ 12294,52
 */
export function projectYear(movements, today) {
  const [year, month, day] = today.split('-').map(Number);
  const monthStart = today.slice(0, 8) + '01';

  const yearTotal = movements.reduce((sum, m) => sum + m.amount, 0);
  const closedTotal = movements
    .filter((m) => m.date < monthStart)
    .reduce((sum, m) => sum + m.amount, 0);

  const yearStart = Date.UTC(year, 0, 1);
  const daysInYear = (Date.UTC(year + 1, 0, 1) - yearStart) / DAY_MS;
  const daysElapsed = (Date.UTC(year, month - 1, day) - yearStart) / DAY_MS + 1;
  const daysLeft = daysInYear - daysElapsed;

  const completeMonths = month - 1;
  if (completeMonths === 0) {
    return { yearTotal, completeMonths, daysLeft, avgPerMonth: null, remaining: null, projection: null };
  }

  const avgPerMonth = closedTotal / completeMonths;
  const remaining = avgPerMonth * 12 * (daysLeft / daysInYear);
  return { yearTotal, completeMonths, daysLeft, avgPerMonth, remaining, projection: yearTotal + remaining };
}
