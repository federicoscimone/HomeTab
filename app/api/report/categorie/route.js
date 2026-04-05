/**
 * @fileoverview API route — /api/report/categorie
 * GET — per-category monthly data for the selected year with YoY comparison.
 *
 * Query params:
 *   year       {number} - Calendar year.
 *   type       {string} - 'expense' | 'income'.
 *   categoryId {string} - Optional: restrict to a single category ObjectId.
 *
 * Response: { year, type, categories[] } where each category has
 * monthly[], totalCur, totalPrev, avg, deltaAbs, deltaPct.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Category from '@/lib/models/Category';

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const year       = parseInt(searchParams.get('year') || new Date().getFullYear());
  const categoryId = searchParams.get('categoryId') || null;
  const type       = searchParams.get('type') || 'expense';

  const categories = await Category.find({ level: 1 }).sort({ order: 1, name: 1 }).lean();

  // Per ogni categoria calcola: mensile anno corrente + anno precedente
  const result = [];

  const catsToProcess = categoryId
    ? categories.filter(c => c._id.toString() === categoryId)
    : categories;

  for (const cat of catsToProcess) {
    const fromCur  = `${year}-01-01`;
    const toCur    = `${year}-12-31`;
    const fromPrev = `${year - 1}-01-01`;
    const toPrev   = `${year - 1}-12-31`;

    const [curExp, prevExp] = await Promise.all([
      Expense.find({
        $or: [{ categoryId: cat._id }, { subCategory1Id: cat._id }],
        date: { $gte: fromCur, $lte: toCur }, type,
        excludeFromAnalysis: { $ne: true },
      }).lean(),
      Expense.find({
        $or: [{ categoryId: cat._id }, { subCategory1Id: cat._id }],
        date: { $gte: fromPrev, $lte: toPrev }, type,
        excludeFromAnalysis: { $ne: true },
      }).lean(),
    ]);

    if (curExp.length === 0 && prevExp.length === 0) continue;

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const cur  = curExp .filter(e => parseInt(e.date.split('-')[1]) === m).reduce((s,e) => s + e.amount, 0);
      const prev = prevExp.filter(e => parseInt(e.date.split('-')[1]) === m).reduce((s,e) => s + e.amount, 0);
      return { month: m, cur, prev };
    });

    const totalCur  = curExp .reduce((s,e) => s + e.amount, 0);
    const totalPrev = prevExp.reduce((s,e) => s + e.amount, 0);
    const monthsWithData = monthly.filter(m => m.cur > 0).length || 1;
    const avg = totalCur / monthsWithData;

    result.push({
      categoryId:   cat._id.toString(),
      categoryName: cat.name,
      color:        cat.color,
      monthly,
      totalCur,
      totalPrev,
      avg,
      deltaAbs: totalCur - totalPrev,
      deltaPct: totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null,
    });
  }

  result.sort((a, b) => b.totalCur - a.totalCur);

  return NextResponse.json({ year, type, categories: result });
}
