/**
 * @fileoverview API route — /api/report/pivot
 * GET — returns a category × month pivot matrix for a given year/type/paymentGroup.
 *
 * Query params:
 *   year         {number} - Calendar year.
 *   type         {string} - 'expense' | 'income'.
 *   paymentGroup {string} - Optional: 'traditional' | 'alternative'.
 *
 * Response: { rows[], monthTotals{1..12}, grandTotal }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import Category from '@/lib/models/Category';

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const year         = parseInt(searchParams.get('year') || new Date().getFullYear());
  const type         = searchParams.get('type') || 'expense';       // expense | income
  const paymentGroup = searchParams.get('paymentGroup') || '';

  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;

  const filter = { date: { $gte: from, $lte: to }, type, excludeFromAnalysis: { $ne: true } };
  if (paymentGroup) filter.paymentGroup = paymentGroup;

  const [expenses, categories] = await Promise.all([
    Movement.find(filter).lean(),
    Category.find({ level: 1 }).sort({ order: 1, name: 1 }).lean(),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Costruisce la matrice categoria × mese
  const matrix = {};
  const monthTotals = {};
  months.forEach(m => { monthTotals[m] = 0; });

  for (const exp of expenses) {
    const m       = parseInt(exp.date.split('-')[1]);
    const catId   = exp.categoryId?.toString() || 'uncategorized';

    if (!matrix[catId]) matrix[catId] = { monthly: {}, total: 0 };
    matrix[catId].monthly[m] = (matrix[catId].monthly[m] || 0) + exp.amount;
    matrix[catId].total      += exp.amount;
    monthTotals[m]           += exp.amount;
  }

  // Costruisce righe con nome categoria
  const catMap = {};
  for (const c of categories) catMap[c._id.toString()] = c;

  const rows = Object.entries(matrix)
    .map(([catId, data]) => ({
      categoryId:   catId,
      categoryName: catMap[catId]?.name  || 'Senza categoria',
      color:        catMap[catId]?.color || '#94a3b8',
      monthly:      data.monthly,
      total:        data.total,
      avg:          data.total / 12,
    }))
    .sort((a, b) => b.total - a.total);

  // Aggiunge categoria "non categorizzate" se presente
  const grandTotal = Object.values(monthTotals).reduce((s, v) => s + v, 0);

  return NextResponse.json({ year, type, rows, monthTotals, grandTotal, months });
}
