/**
 * @fileoverview API route — /api/report/analisi
 * GET — advanced analysis for a custom date range with YoY comparison and projections.
 *
 * Query params:
 *   from {string} - Start date YYYY-MM-DD (required).
 *   to   {string} - End date YYYY-MM-DD (required).
 *   type {string} - 'expense' | 'income'.
 *
 * Response: totals, byCategory comparison, weekly breakdown, year-end projection.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const type = searchParams.get('type') || 'expense';

  if (!from || !to) return NextResponse.json({ error: 'from e to obbligatori' }, { status: 400 });

  // Stesso periodo anno precedente
  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const prevFrom = new Date(fromDate); prevFrom.setFullYear(prevFrom.getFullYear() - 1);
  const prevTo   = new Date(toDate);   prevTo  .setFullYear(prevTo  .getFullYear() - 1);
  const prevFromStr = prevFrom.toISOString().split('T')[0];
  const prevToStr   = prevTo  .toISOString().split('T')[0];

  const [curExp, prevExp] = await Promise.all([
    Movement.find({ date: { $gte: from, $lte: to }, type, excludeFromAnalysis: { $ne: true } })
      .populate('categoryId', 'name color').lean(),
    Movement.find({ date: { $gte: prevFromStr, $lte: prevToStr }, type, excludeFromAnalysis: { $ne: true } })
      .populate('categoryId', 'name color').lean(),
  ]);

  const totalCur  = curExp .reduce((s,e) => s + e.amount, 0);
  const totalPrev = prevExp.reduce((s,e) => s + e.amount, 0);

  // Per categoria
  const byCatCur  = groupByCategory(curExp);
  const byCatPrev = groupByCategory(prevExp);
  const allCatIds = new Set([...Object.keys(byCatCur), ...Object.keys(byCatPrev)]);

  const byCategory = [...allCatIds].map(id => {
    const cur  = byCatCur [id] || { name: 'Senza categoria', color: '#94a3b8', amount: 0 };
    const prev = byCatPrev[id] || { amount: 0 };
    const delta = cur.amount - prev.amount;
    const pct   = prev.amount > 0 ? (delta / prev.amount) * 100 : null;
    return { id, name: cur.name, color: cur.color, cur: cur.amount, prev: prev.amount, delta, pct };
  }).sort((a, b) => b.cur - a.cur);

  // Proiezione fine anno (basata sulla media mensile del periodo selezionato)
  const curYear   = new Date().getFullYear();
  const curMonth  = new Date().getMonth() + 1;
  const yearFrom  = `${curYear}-01-01`;
  const yearTo    = `${curYear}-12-31`;
  const yearExp   = await Movement.find({ date: { $gte: yearFrom, $lte: yearTo }, type, excludeFromAnalysis: { $ne: true } }).lean();
  const yearTotal = yearExp.reduce((s,e) => s + e.amount, 0);
  const monthsElapsed = curMonth;
  const avgPerMonth   = monthsElapsed > 0 ? yearTotal / monthsElapsed : 0;
  const projection    = avgPerMonth * 12;
  const remaining     = projection - yearTotal;

  // Andamento per settimana nel range selezionato
  const weeklyMap = {};
  for (const e of curExp) {
    const d  = new Date(e.date);
    const yw = getYearWeek(d);
    weeklyMap[yw] = (weeklyMap[yw] || 0) + e.amount;
  }
  const weekly = Object.entries(weeklyMap)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([week, amount]) => ({ week, amount }));

  return NextResponse.json({
    from, to, type,
    prevFrom: prevFromStr, prevTo: prevToStr,
    totalCur, totalPrev,
    deltaAbs: totalCur - totalPrev,
    deltaPct: totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null,
    byCategory,
    weekly,
    projection: {
      yearTotal, avgPerMonth, projection, remaining,
      monthsElapsed, monthsRemaining: 12 - monthsElapsed,
    },
  });
}

function groupByCategory(expenses) {
  const map = {};
  for (const e of expenses) {
    const id    = e.categoryId?._id?.toString() || 'uncategorized';
    const name  = e.categoryId?.name  || 'Senza categoria';
    const color = e.categoryId?.color || '#94a3b8';
    if (!map[id]) map[id] = { name, color, amount: 0 };
    map[id].amount += e.amount;
  }
  return map;
}

function getYearWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
}
