/**
 * @fileoverview Il simulatore «e se…?»: la base (proiezione dell'anno, obiettivi, spesa media per
 * categoria) e la validazione dei cambiamenti. I calcoli sono in lib/utils/scenario.js.
 * @module lib/services/scenario
 *
 * Stesso perimetro della proiezione e della dashboard: pagamenti tradizionali, senza i movimenti
 * esclusi dalle analisi.
 */

import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Movement from '../models/Movement.js';
import { getGoalsOverview } from './goals.js';
import { yearProjection } from './projection.js';
import { comparisonWindow } from '../utils/istat.js';
import { monthOf } from '../utils/goalMath.js';
import { simulate } from '../utils/scenario.js';

export const MAX_CHANGES = 10;
const TYPES = ['income', 'category', 'oneOff', 'installment'];
const round2 = (v) => Math.round(v * 100) / 100;

/** Spesa media mensile per categoria di primo livello, sugli ultimi 12 mesi completi. */
async function categoryAverages(now) {
  const first = await Movement.findOne({ type: 'expense', paymentGroup: 'traditional' }).sort({ date: 1 }).select('date').lean();
  const window = comparisonWindow(now, first?.date ?? null);
  if (!window.months) return { averages: {}, window };
  const rows = await Movement.aggregate([
    { $match: { type: 'expense', paymentGroup: 'traditional', excludeFromAnalysis: { $ne: true }, date: { $gte: window.from, $lte: window.to }, categoryId: { $ne: null } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
  ]);
  return { averages: Object.fromEntries(rows.map((r) => [String(r._id), round2(r.total / window.months)])), window };
}

/**
 * Ciò che serve al simulatore: la proiezione dei mesi che restano, gli obiettivi con la loro
 * percentuale e la spesa media delle categorie.
 *
 * @param {{ now?: Date }} [options]
 */
export async function scenarioBase({ now = new Date() } = {}) {
  const [{ projection }, overview, { averages, window }, categories] = await Promise.all([
    yearProjection({ now }),
    getGoalsOverview(now),
    categoryAverages(now),
    Category.find({ level: 1 }).sort({ order: 1, name: 1 }).select('name').lean(),
  ]);
  const months = projection?.months ?? [];
  return {
    start: monthOf(now),
    yearToDate: round2(months.filter((m) => m.kind === 'actual').reduce((s, m) => s + m.savings, 0)),
    baseThisYear: months.filter((m) => m.kind !== 'actual').map((m) => m.savings),
    // Il risparmio medio degli obiettivi (ultimi mesi chiusi); senza dati, quello previsto per i mesi che restano.
    baseAfter: overview.avgSavings ?? (months.length ? round2(months.reduce((s, m) => s + m.savings, 0) / months.length) : 0),
    goals: overview.goals
      .filter((g) => g.status === 'active' && g.state !== 'reached')
      .map((g) => ({ name: g.name, saved: g.saved, target: g.targetAmount, pct: g.pct ?? null, deadline: g.deadline })),
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, monthly: averages[String(c._id)] ?? 0 })),
    categoryAvg: averages,
    averageWindow: window,
  };
}

/**
 * Valida i cambiamenti di un'ipotesi.
 *
 * @param {any} changes
 * @returns {{ data?: object[], error?: string }}
 */
export function parseChanges(changes) {
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > MAX_CHANGES) return { error: 'invalidData' };
  const month = (v) => v == null || (typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v));
  const amount = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1_000_000;
  const data = [];
  for (const c of changes) {
    if (!c || !TYPES.includes(c.type) || !month(c.from)) return { error: 'invalidData' };
    if (c.months != null && !(Number.isInteger(c.months) && c.months >= 1 && c.months <= 360)) return { error: 'invalidData' };
    const out = { type: c.type, from: c.from ?? null, months: c.months ?? null };
    if (c.type === 'category') {
      if (!mongoose.isValidObjectId(c.categoryId)) return { error: 'invalidData' };
      out.categoryId = String(c.categoryId);
      if (c.percent != null) {
        if (!(typeof c.percent === 'number' && c.percent >= -100 && c.percent <= 1000)) return { error: 'invalidData' };
        out.percent = c.percent;
      } else if (amount(c.amount)) out.amount = c.amount;
      else return { error: 'invalidData' };
    } else {
      if (!amount(c.amount)) return { error: 'invalidData' };
      out.amount = c.amount;
      if (c.type === 'oneOff') out.income = c.income === true;
    }
    data.push(out);
  }
  return { data };
}

/**
 * @param {object[]} changes - Già validati con parseChanges.
 * @param {{ now?: Date }} [options]
 */
export async function runScenario(changes, { now = new Date() } = {}) {
  const base = await scenarioBase({ now });
  return { ...simulate({ ...base, changes }), changes };
}
