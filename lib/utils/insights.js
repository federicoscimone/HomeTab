/**
 * @fileoverview I segnali di risparmio: fatti calcolati sui movimenti, ognuno con un importo.
 * @module lib/utils/insights
 *
 * Il codice trova i segnali e ne stima il peso; l'IA (lib/ai/tasks/advice.js) sceglie i più utili e
 * li spiega, senza introdurre numeri suoi. Qui solo funzioni pure, così le soglie si provano nei
 * test. I movimenti in ingresso sono uscite che entrano nelle analisi.
 *
 * Quattro tipi:
 * - recurring: stessa spesa ogni mese dallo stesso esercente (abbonamenti, bollette), con il
 *   costo annuo. Oltre MAX_RECURRING_MONTHLY al mese sono affitti e rate, che non si tagliano con
 *   una disdetta: restano fuori.
 * - growth: categorie degli ultimi 3 mesi completi in crescita sugli stessi mesi dell'anno prima.
 * - anomaly: l'ultimo mese completo molto sopra la media dei 6 precedenti in una categoria.
 * - istat: capitoli sopra la media delle famiglie simili (casa esclusa: lì pesa soprattutto
 *   l'essere in affitto o proprietari, non le abitudini).
 *
 * `potential` è il risparmio annuo possibile in euro, la misura con cui i segnali si ordinano.
 */

import { addMonths, monthDiff } from './goalMath.js';
import { historyText, merchantTokens } from './merchantHistory.js';

export const MAX_RECURRING_MONTHLY = 200;
const RECURRING_TOLERANCE = 0.15;
const RECURRING_MIN_MONTHS = 3;
const RECURRING_MAX_PER_MONTH = 1.5;
const RECURRING_ACTIVE_DAYS = 45;
const RECURRING_MIN_COVERAGE = 0.75;
const GROWTH_MIN_MONTHLY = 15;
const GROWTH_MIN_PCT = 20;
const ANOMALY_MIN_EXCESS = 50;
const ANOMALY_MIN_RATIO = 1.5;
const ISTAT_MIN_MONTHLY = 30;
const ISTAT_MIN_PCT = 20;

const round2 = (v) => Math.round(v * 100) / 100;
const monthOfDate = (date) => date.slice(0, 7);
const lastDay = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};
const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86_400_000);
const mostCommon = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/**
 * @typedef {Object} SignalMovement
 * @property {string} date - YYYY-MM-DD.
 * @property {number} amount
 * @property {string} [payee]
 * @property {string} [description]
 * @property {string|null} categoryId
 */

/**
 * Spese ricorrenti mensili, attive (l'ultima negli ultimi 45 giorni).
 *
 * @param {SignalMovement[]} movements - Uscite degli ultimi mesi.
 * @param {{ today: string }} options
 */
export function recurringSignals(movements, { today }) {
  const from = `${addMonths(monthOfDate(today), -6)}-01`;
  const groups = new Map();
  for (const m of movements) {
    if (m.date < from || m.date > today) continue;
    const tokens = merchantTokens(historyText(m)).slice(0, 2);
    if (!tokens.length) continue;
    const key = tokens.join(' ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const out = [];
  for (const [key, list] of groups) {
    const typical = median(list.map((m) => m.amount));
    // Solo gli importi vicini a quello tipico: la bolletta, non l'acquisto occasionale nello
    // stesso negozio.
    const same = list.filter((m) => Math.abs(m.amount - typical) <= Math.max(typical * RECURRING_TOLERANCE, 1));
    const months = new Set(same.map((m) => monthOfDate(m.date)));
    const last = same.map((m) => m.date).sort().at(-1);
    if (months.size < RECURRING_MIN_MONTHS) continue;
    if (same.length / months.size > RECURRING_MAX_PER_MONTH) continue; // la spesa al supermercato
    // Mensile davvero: i mesi con il pagamento coprono quasi tutto l'arco fra il primo e
    // l'ultimo. Un mese saltato passa; una TARI o un abbonamento trimestrale (un mese su tre) no,
    // e lo trovano le scadenze, con la sua cadenza.
    const sorted = [...months].sort();
    const span = monthDiff(sorted[0], sorted.at(-1)) + 1;
    if (months.size < span * RECURRING_MIN_COVERAGE) continue;
    if (daysBetween(last, today) > RECURRING_ACTIVE_DAYS) continue;    // disdetta
    if (typical > MAX_RECURRING_MONTHLY) continue;
    const monthly = round2(median(same.map((m) => m.amount)));
    out.push({
      key: `recurring:${key}`,
      kind: 'recurring',
      merchant: key,
      sample: historyText(same.at(-1)),
      sampleRow: { payee: same.at(-1).payee ?? '', description: same.at(-1).description ?? '' },
      categoryId: mostCommon(same.map((m) => m.categoryId).filter(Boolean)),
      monthly,
      months: months.size,
      lastDate: last,
      potential: round2(monthly * 12),
      monthlySaving: monthly,
      from,
      to: today,
    });
  }
  return out;
}

/** Totali per categoria di primo livello fra due date comprese. */
function totalsByCategory(movements, from, to) {
  const out = new Map();
  for (const m of movements) {
    if (!m.categoryId || m.date < from || m.date > to) continue;
    out.set(m.categoryId, (out.get(m.categoryId) ?? 0) + m.amount);
  }
  return out;
}

/**
 * Categorie in crescita: ultimi 3 mesi completi contro gli stessi mesi dell'anno prima.
 *
 * @param {SignalMovement[]} movements
 * @param {{ today: string }} options
 */
export function growthSignals(movements, { today }) {
  const lastMonth = addMonths(monthOfDate(today), -1);
  const from = `${addMonths(lastMonth, -2)}-01`;
  const to = lastDay(lastMonth);
  const prevFrom = `${Number(from.slice(0, 4)) - 1}${from.slice(4)}`;
  const prevTo = lastDay(`${Number(to.slice(0, 4)) - 1}${to.slice(4, 7)}`);
  // Senza movimenti un anno prima non c'è confronto, non una crescita.
  if (!movements.some((m) => m.date <= prevTo)) return [];

  const cur = totalsByCategory(movements, from, to);
  const prev = totalsByCategory(movements, prevFrom, prevTo);
  const out = [];
  for (const [categoryId, total] of cur) {
    const before = prev.get(categoryId) ?? 0;
    if (before <= 0) continue;
    const deltaMonthly = (total - before) / 3;
    const pct = ((total - before) / before) * 100;
    if (deltaMonthly < GROWTH_MIN_MONTHLY || pct < GROWTH_MIN_PCT) continue;
    out.push({
      key: `growth:${categoryId}`,
      kind: 'growth',
      categoryId,
      recentMonthly: round2(total / 3),
      previousMonthly: round2(before / 3),
      pct: round2(pct),
      potential: round2(deltaMonthly * 12),
      monthlySaving: round2(deltaMonthly),
      from, to, prevFrom, prevTo,
    });
  }
  return out;
}

/**
 * L'ultimo mese completo molto sopra la media dei 6 precedenti, per categoria. Serve che i dati
 * coprano tutti e 6 i mesi, altrimenti la media non dice niente.
 *
 * @param {SignalMovement[]} movements
 * @param {{ today: string }} options
 */
export function anomalySignals(movements, { today }) {
  const month = addMonths(monthOfDate(today), -1);
  const baseFrom = `${addMonths(month, -6)}-01`;
  const baseTo = lastDay(addMonths(month, -1));
  const first = movements.reduce((min, m) => (m.date < min ? m.date : min), '9999');
  if (first > lastDay(addMonths(month, -6))) return [];

  const cur = totalsByCategory(movements, `${month}-01`, lastDay(month));
  const base = totalsByCategory(movements, baseFrom, baseTo);
  const out = [];
  for (const [categoryId, amount] of cur) {
    const average = (base.get(categoryId) ?? 0) / 6;
    const excess = amount - average;
    if (excess < ANOMALY_MIN_EXCESS || amount < average * ANOMALY_MIN_RATIO) continue;
    out.push({
      key: `anomaly:${categoryId}:${month}`,
      kind: 'anomaly',
      categoryId,
      month,
      amount: round2(amount),
      average: round2(average),
      potential: round2(excess),
      monthlySaving: null, // una tantum: non è una cifra da mettere da parte ogni mese
      from: `${month}-01`,
      to: lastDay(month),
    });
  }
  return out;
}

/**
 * Capitoli sopra la media delle famiglie simili (vedi lib/services/istatCompare.js).
 *
 * @param {{ rows: { code: string, yours: number|null, istat: number|null, diff: number|null, pct: number|null }[] }} comparison
 */
export function istatSignals(comparison) {
  return comparison.rows
    .filter((r) => r.code !== '04' && r.diff != null && r.diff >= ISTAT_MIN_MONTHLY && r.pct >= ISTAT_MIN_PCT)
    .map((r) => ({
      key: `istat:${r.code}`,
      kind: 'istat',
      code: r.code,
      yours: r.yours,
      istat: r.istat,
      pct: r.pct,
      potential: round2(r.diff * 12),
      monthlySaving: r.diff,
    }));
}

/**
 * In ordine di risparmio possibile, senza quelli che la famiglia ha segnato come non utili.
 *
 * @param {object[]} signals
 * @param {{ hidden?: Set<string>, perKind?: number, limit?: number }} [options]
 */
export function rankSignals(signals, { hidden = new Set(), perKind = Infinity, limit = Infinity } = {}) {
  const counts = {};
  const out = [];
  for (const s of [...signals].sort((a, b) => b.potential - a.potential)) {
    if (hidden.has(s.key)) continue;
    counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    if (counts[s.kind] > perKind) continue;
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Quanti mesi prima si arriva a un obiettivo mettendo da parte `monthly` in più ogni mese.
 *
 * @param {{ remaining: number, expectedQuota: number|null }} projection - Da projectGoal.
 * @param {number} monthly
 * @param {string} currentMonth - YYYY-MM.
 * @returns {{ monthsEarlier: number|null, reachMonth: string }|null} monthsEarlier è null se oggi
 *   l'obiettivo non avanza affatto (nessuna quota): allora conta il mese di arrivo.
 */
export function goalImpact(projection, monthly, currentMonth) {
  if (!projection || !(projection.remaining > 0) || !(monthly > 0)) return null;
  const quota = projection.expectedQuota > 0 ? projection.expectedQuota : 0;
  const withSaving = Math.ceil(projection.remaining / (quota + monthly));
  const reachMonth = addMonths(currentMonth, withSaving - 1);
  if (!quota) return { monthsEarlier: null, reachMonth };
  const monthsEarlier = Math.ceil(projection.remaining / quota) - withSaving;
  return monthsEarlier >= 1 ? { monthsEarlier, reachMonth } : null;
}

