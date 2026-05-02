/**
 * @fileoverview API route — /api/report/categorie
 * GET — per-category data with YoY comparison.
 *
 * Query params:
 *   year       {number} - Calendar year.
 *   type       {string} - 'expense' | 'income'.
 *   paymentGroup {string} - Optional: 'traditional' | 'alternative'.
 *   month      {number} - Optional (1-12): if set, returns data for that month vs same month of previous year.
 *   categoryId {string} - Optional: restrict to a single category ObjectId.
 *
 * Response: { year, type, month?, categories[] } where each category has:
 *   - If month not set: monthly[], totalCur, totalPrev, avg, deltaAbs, deltaPct
 *   - If month set: totalCur, totalPrev, deltaAbs, deltaPct (single month, no breakdown)
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
  const year       = parseInt(searchParams.get('year') || new Date().getFullYear());
  const categoryId = searchParams.get('categoryId') || null;
  const type       = searchParams.get('type') || 'expense';
  const paymentGroup = searchParams.get('paymentGroup') || '';
  const month      = searchParams.get('month') ? parseInt(searchParams.get('month')) : null;

  const categories = await Category.find({ level: 1 }).sort({ name: 1 }).lean();

  // Per ogni categoria calcola: mensile anno corrente + anno precedente
  const result = [];

  const catsToProcess = categoryId
    ? categories.filter(c => c._id.toString() === categoryId)
    : categories;

  for (const cat of catsToProcess) {
    let fromCur, toCur, fromPrev, toPrev;

    if (month) {
      // Filtro per mese specifico
      const monthStr = String(month).padStart(2, '0');
      fromCur  = `${year}-${monthStr}-01`;
      toCur    = `${year}-${monthStr}-31`;
      fromPrev = `${year - 1}-${monthStr}-01`;
      toPrev   = `${year - 1}-${monthStr}-31`;
    } else {
      // Filtro per anno intero
      fromCur  = `${year}-01-01`;
      toCur    = `${year}-12-31`;
      fromPrev = `${year - 1}-01-01`;
      toPrev   = `${year - 1}-12-31`;
    }

    const baseFilter = {
      $or: [{ categoryId: cat._id }, { subCategory1Id: cat._id }],
      type,
      excludeFromAnalysis: { $ne: true },
    };
    if (paymentGroup) baseFilter.paymentGroup = paymentGroup;

    const [curExp, prevExp] = await Promise.all([
      Movement.find({
        ...baseFilter,
        date: { $gte: fromCur, $lte: toCur },
      }).lean(),
      Movement.find({
        ...baseFilter,
        date: { $gte: fromPrev, $lte: toPrev },
      }).lean(),
    ]);

    if (curExp.length === 0 && prevExp.length === 0) continue;

    const totalCur  = curExp .reduce((s,e) => s + e.amount, 0);
    const totalPrev = prevExp.reduce((s,e) => s + e.amount, 0);

    const catResult = {
      categoryId:   cat._id.toString(),
      categoryName: cat.name,
      color:        cat.color,
      totalCur,
      totalPrev,
      deltaAbs: totalCur - totalPrev,
      deltaPct: totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null,
    };

    // Se non è filtro per mese, aggiungi il breakdown mensile e media
    if (!month) {
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const cur  = curExp .filter(e => parseInt(e.date.split('-')[1]) === m).reduce((s,e) => s + e.amount, 0);
        const prev = prevExp.filter(e => parseInt(e.date.split('-')[1]) === m).reduce((s,e) => s + e.amount, 0);
        return { month: m, cur, prev };
      });
      const monthsWithData = monthly.filter(m => m.cur > 0).length || 1;
      catResult.monthly = monthly;
      catResult.avg = totalCur / monthsWithData;
    }

    result.push(catResult);
  }

  result.sort((a, b) => b.totalCur - a.totalCur);

  const response = { year, type, categories: result };
  if (paymentGroup) response.paymentGroup = paymentGroup;
  if (month) response.month = month;

  return NextResponse.json(response);
}
