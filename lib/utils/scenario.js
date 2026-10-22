/**
 * @fileoverview «E se…?»: l'effetto di un'ipotesi sul risparmio e sugli obiettivi.
 * @module lib/utils/scenario
 *
 * Un'ipotesi è un elenco di cambiamenti, ognuno tradotto in uno scarto sul risparmio di ogni mese
 * (positivo = si risparmia di più):
 * - income:      entrate che cambiano di `amount` al mese, da `from`, per `months` mesi (o sempre);
 * - category:    una categoria che cambia di `percent` (es. -30) o di `amount` al mese;
 * - oneOff:      una spesa di `amount` una volta sola, a `from` (con `income: true`, un'entrata);
 * - installment: una rata di `amount` al mese per `months` mesi.
 *
 * Gli obiettivi si simulano mese per mese come fa l'app: ogni mese ricevono la loro percentuale
 * del risparmio (mai meno di zero), fino al traguardo. Funzioni pure, provate nei test.
 */

import { addMonths, monthDiff } from './goalMath.js';

/** Oltre dieci anni la simulazione si ferma: un obiettivo che non arriva prima, non arriva. */
export const MAX_MONTHS = 120;

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Lo scarto sul risparmio, mese per mese, da `start` per `horizon` mesi.
 *
 * @param {object[]} changes
 * @param {{ start: string, horizon: number, categoryAvg: Record<string, number> }} ctx -
 *   categoryAvg: spesa media mensile di ogni categoria (per i cambiamenti in percentuale).
 * @returns {number[]} Un valore per ogni mese della finestra.
 */
export function monthlyDeltas(changes, { start, horizon, categoryAvg }) {
  const deltas = Array(horizon).fill(0);
  for (const c of changes) {
    const from = Math.max(0, monthDiff(start, c.from ?? start));
    const span = c.type === 'oneOff' ? 1 : (c.months ?? horizon);
    let perMonth = 0;
    if (c.type === 'income') perMonth = c.amount;
    else if (c.type === 'installment') perMonth = -Math.abs(c.amount);
    else if (c.type === 'oneOff') perMonth = c.income ? Math.abs(c.amount) : -Math.abs(c.amount);
    else if (c.type === 'category') {
      // Spendere di meno fa risparmiare di più: lo scarto ha il segno opposto al cambiamento.
      const base = categoryAvg[c.categoryId] ?? 0;
      perMonth = -(c.percent != null ? (base * c.percent) / 100 : c.amount);
    }
    for (let i = from; i < Math.min(horizon, from + span); i += 1) deltas[i] += perMonth;
  }
  return deltas.map(round2);
}

/**
 * Il mese in cui un obiettivo arriva al traguardo, ricevendo ogni mese `pct`% del risparmio.
 *
 * @param {{ saved: number, target: number, pct: number, monthly: (i: number) => number, start: string }} args -
 *   monthly(i): il risparmio del mese i dalla partenza.
 * @returns {string|null} YYYY-MM, o null se non arriva entro MAX_MONTHS.
 */
export function goalReach({ saved, target, pct, monthly, start }) {
  if (saved >= target) return start;
  if (!(pct > 0)) return null;
  let total = saved;
  for (let i = 0; i < MAX_MONTHS; i += 1) {
    total += Math.max(0, monthly(i)) * (pct / 100);
    if (total >= target - 0.005) return addMonths(start, i);
  }
  return null;
}

/**
 * Il confronto completo fra la situazione attuale e quella con l'ipotesi.
 *
 * @param {Object} args
 * @param {object[]} args.changes
 * @param {string} args.start - Primo mese della simulazione (YYYY-MM): il mese in corso.
 * @param {number[]} args.baseThisYear - Risparmio previsto dei mesi da `start` a dicembre
 *   (dalla proiezione dell'anno).
 * @param {number} args.baseAfter - Risparmio medio mensile (quello degli obiettivi): vale dopo
 *   dicembre per i totali, e per tutti i mesi nella simulazione degli obiettivi.
 * @param {Record<string, number>} args.categoryAvg
 * @param {{ name: string, saved: number, target: number, pct: number|null, deadline: string }[]} args.goals
 * @param {number} args.yearToDate - Risparmio già fatto quest'anno, prima di `start`.
 */
export function simulate({ changes, start, baseThisYear, baseAfter, categoryAvg, goals, yearToDate }) {
  const horizon = MAX_MONTHS;
  const deltas = monthlyDeltas(changes, { start, horizon, categoryAvg });
  const base = (i) => (i < baseThisYear.length ? baseThisYear[i] : baseAfter);
  const withChanges = (i) => base(i) + deltas[i];
  const sum = (fn, n) => round2(Array.from({ length: n }, (_, i) => fn(i)).reduce((a, b) => a + b, 0));

  const restOfYear = baseThisYear.length;
  // Per gli obiettivi la base è il risparmio medio costante, come nella pagina Obiettivi: così il
  // «prima» coincide con quello che l'app mostra già, e lo scarto è solo l'effetto dell'ipotesi.
  const goalBase = () => baseAfter;
  const goalWith = (i) => baseAfter + deltas[i];
  const goalRows = goals.filter((g) => g.pct != null).map((g) => {
    const before = goalReach({ ...g, monthly: goalBase, start });
    const after = goalReach({ ...g, monthly: goalWith, start });
    return {
      name: g.name,
      deadline: g.deadline,
      before,
      after,
      // Positivo = l'obiettivo arriva più tardi.
      shift: before && after ? monthDiff(before, after) : null,
      onTimeBefore: Boolean(before && before <= g.deadline),
      onTimeAfter: Boolean(after && after <= g.deadline),
    };
  });

  return {
    start,
    yearEnd: { before: round2(yearToDate + sum(base, restOfYear)), after: round2(yearToDate + sum(withChanges, restOfYear)) },
    next12: { before: sum(base, 12), after: sum(withChanges, 12) },
    months: Array.from({ length: 12 }, (_, i) => ({ month: addMonths(start, i), before: round2(base(i)), after: round2(withChanges(i)) })),
    goals: goalRows,
  };
}
