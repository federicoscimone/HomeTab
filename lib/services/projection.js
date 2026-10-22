/**
 * @fileoverview «Quanto avremo risparmiato quest'anno continuando così?» e «riusciremo a
 * raggiungere gli obiettivi?», con i numeri calcolati dal codice.
 * @module lib/services/projection
 *
 * Usato dalla dashboard e dallo strumento proiezione_anno della chat. Il risparmio è quello della
 * dashboard: entrate meno uscite, pagamenti tradizionali, senza i movimenti esclusi dalle analisi.
 */

import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Movement from '../models/Movement.js';
import { getGoalsOverview } from './goals.js';
import { dayOf } from '../utils/goalMath.js';
import { projectSavings } from '../utils/savingsProjection.js';

const SCOPE = { paymentGroup: 'traditional', excludeFromAnalysis: { $ne: true } };

/**
 * La condizione per contare un'entrata: tutte, o solo quelle di alcune categorie, o tutte tranne
 * alcune. Una categoria si confronta con categoryId, una sottocategoria con subCategory1Id.
 *
 * @param {string[]} only - Id di categorie o sottocategorie.
 * @param {string[]} exclude
 */
async function incomeCondition(only = [], exclude = []) {
  const ids = [...only, ...exclude];
  const levels = ids.length
    ? new Map((await Category.find({ _id: { $in: ids } }).select('level').lean()).map((c) => [String(c._id), c.level]))
    : new Map();
  const field = (id) => (levels.get(id) === 2 ? '$subCategory1Id' : '$categoryId');
  const oid = (id) => new mongoose.Types.ObjectId(id);
  const conds = [{ $eq: ['$type', 'income'] }];
  if (only.length) conds.push({ $or: only.map((id) => ({ $eq: [field(id), oid(id)] })) });
  for (const id of exclude) conds.push({ $ne: [field(id), oid(id)] });
  return { $and: conds };
}

/**
 * @param {{ now?: Date, incomeOnly?: string[], incomeExclude?: string[] }} [options]
 *   `incomeOnly` / `incomeExclude`: id di categorie o sottocategorie di entrata da contare, o da
 *   non contare («quanto risparmiamo con il solo stipendio?»). Le uscite restano tutte.
 */
export async function yearProjection({ now = new Date(), incomeOnly = [], incomeExclude = [] } = {}) {
  const today = dayOf(now);
  const year = now.getFullYear();
  const isIncome = await incomeCondition(incomeOnly, incomeExclude);
  const [rows, first, overview] = await Promise.all([
    Movement.aggregate([
      { $match: { ...SCOPE, date: { $gte: `${year - 1}-01-01`, $lte: today } } },
      {
        $group: {
          _id: { $substrBytes: ['$date', 0, 7] },
          income: { $sum: { $cond: [isIncome, '$amount', 0] } },
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
