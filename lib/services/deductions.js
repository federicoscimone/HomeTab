/**
 * @fileoverview Le spese detraibili di un anno, per il 730. Regole in lib/utils/deductions.js.
 * @module lib/services/deductions
 *
 * Contano tutte le uscite dell'anno, anche quelle escluse dalle analisi: una grossa spesa medica
 * tolta dai report perché eccezionale resta detraibile.
 */

import Category from '../models/Category.js';
import Movement from '../models/Movement.js';
import { defaultDeduction, summarizeDeductions } from '../utils/deductions.js';

/** @param {{ year: number }} args */
export async function deductionReport({ year }) {
  const [movements, categories] = await Promise.all([
    Movement.find({ type: 'expense', date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } })
      .select('date amount payee description paymentMethod categoryId subCategory1Id subCategory2Id deduction')
      .lean(),
    Category.find().select('name level parentId deduction').lean(),
  ]);
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const { types, rows } = summarizeDeductions(movements, byId);
  const name = (id) => (id ? byId.get(String(id))?.name ?? null : null);
  // Escluse a mano: si vedono, per poterle rimettere.
  const excluded = movements.filter((m) => m.deduction === 'none');
  const view = (m) => ({
    id: String(m._id), date: m.date, amount: m.amount, text: m.payee || m.description || '',
    paymentMethod: m.paymentMethod, category: [name(m.categoryId), name(m.subCategory1Id)].filter(Boolean).join(' → '),
    manual: Boolean(m.deduction),
  });
  return {
    year,
    types,
    rows: rows.map((r) => ({ ...view(r), type: r.deductionType, status: r.status })),
    excluded: excluded.map(view),
    mapped: categories.some((c) => c.deduction),
  };
}

/** Il tipo predefinito per ogni categoria del seed che non ne ha uno. */
export async function defaultDeductionsForUnmapped() {
  const cats = await Category.find({ level: { $in: [1, 2] } }).select('name level parentId deduction').lean();
  const byId = new Map(cats.map((c) => [String(c._id), c]));
  return cats.filter((c) => !c.deduction).flatMap((c) => {
    const type = c.level === 1 ? defaultDeduction(c.name) : defaultDeduction(byId.get(String(c.parentId))?.name ?? '', c.name);
    return type ? [[String(c._id), type]] : [];
  });
}
