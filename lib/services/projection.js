/**
 * @fileoverview «Quanto avremo risparmiato quest'anno continuando così?» e «riusciremo a
 * raggiungere gli obiettivi?», con i numeri calcolati dal codice.
 * @module lib/services/projection
 *
 * Usato dalla dashboard e dallo strumento proiezione_anno della chat. Il risparmio è quello della
 * dashboard: entrate meno uscite, pagamenti tradizionali, senza i movimenti esclusi dalle analisi.
 */

import Movement from '../models/Movement.js';
import { getGoalsOverview } from './goals.js';
import { dayOf } from '../utils/goalMath.js';
import { projectSavings } from '../utils/savingsProjection.js';

const SCOPE = { paymentGroup: 'traditional', excludeFromAnalysis: { $ne: true } };

/** @param {{ now?: Date }} [options] */
export async function yearProjection({ now = new Date() } = {}) {
  const today = dayOf(now);
  const year = now.getFullYear();
  const [rows, first, overview] = await Promise.all([
    Movement.aggregate([
      { $match: { ...SCOPE, date: { $gte: `${year - 1}-01-01`, $lte: today } } },
      {
        $group: {
          _id: { $substrBytes: ['$date', 0, 7] },
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, 0, '$amount'] } },
        },
      },
    ]),
    Movement.findOne(SCOPE).sort({ date: 1 }).select('date').lean(),
    getGoalsOverview(now),
  ]);
  const byMonth = Object.fromEntries(rows.map((r) => [r._id, { income: r.income, expense: r.expense }]));
  const projection = projectSavings(byMonth, today, first ? first.date.slice(0, 7) : null);

  const goals = overview.goals.filter((g) => g.status === 'active').map((g) => ({
    id: g.id,
    name: g.name,
    state: g.state, // reached | on_track | behind | no_data …
    target: g.targetAmount,
    saved: g.saved,
    deadline: g.deadline,
    reachMonth: g.projection?.reachMonth ?? null,
    requiredMonthly: g.projection?.requiredMonthly ?? null,
    expectedMonthly: g.projection?.expectedQuota ?? null,
    remaining: g.projection?.remaining ?? null,
  }));

  return { today, projection, goals, avgSavings: overview.avgSavings };
}
