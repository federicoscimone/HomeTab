/**
 * @fileoverview API route — /api/dashboard
 * GET — returns monthly financial summary for the dashboard widgets.
 *
 * Query params:
 *   year  {number} - Calendar year (default: current year).
 *   month {number} - Calendar month 1–12 (default: current month).
 *
 * Response includes: current/previous month totals, byCategory, byMethod,
 * paymentGroups breakdown, and 6-month trend.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import '@/lib/models/Category';

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const now    = new Date();
  const year   = parseInt(searchParams.get('year')  || now.getFullYear());
  const month  = parseInt(searchParams.get('month') || now.getMonth() + 1);

  // Mese corrente e precedente in formato YYYY-MM-DD
  const curFrom = `${year}-${String(month).padStart(2,'0')}-01`;
  const curTo   = `${year}-${String(month).padStart(2,'0')}-31`;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevFrom  = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;
  const prevTo    = `${prevYear}-${String(prevMonth).padStart(2,'0')}-31`;

  const excludeFilter = { excludeFromAnalysis: { $ne: true } };

  const [curExpenses, prevExpenses] = await Promise.all([
    Movement.find({ date: { $gte: curFrom, $lte: curTo }, ...excludeFilter })
      .populate('categoryId', 'name color')
      .lean(),
    Movement.find({ date: { $gte: prevFrom, $lte: prevTo }, ...excludeFilter })
      .lean(),
  ]);

  // Totali mese corrente
  const curTotalExpense = curExpenses
    .filter(e => e.type !== 'income')
    .reduce((s, e) => s + e.amount, 0);
  const curTotalIncome = curExpenses
    .filter(e => e.type === 'income')
    .reduce((s, e) => s + e.amount, 0);

  // Totali mese precedente
  const prevTotalExpense = prevExpenses
    .filter(e => e.type !== 'income')
    .reduce((s, e) => s + e.amount, 0);
  const prevTotalIncome = prevExpenses
    .filter(e => e.type === 'income')
    .reduce((s, e) => s + e.amount, 0);

  // Uscite per categoria (con split tradizionale/alternativo)
  const byCategoryMap = {};
  for (const e of curExpenses.filter(e => e.type !== 'income')) {
    const key   = e.categoryId?._id?.toString() || 'uncategorized';
    const name  = e.categoryId?.name  || 'Senza categoria';
    const color = e.categoryId?.color || '#94a3b8';
    if (!byCategoryMap[key]) byCategoryMap[key] = { name, color, amount: 0, traditional: 0, alternative: 0 };
    byCategoryMap[key].amount += e.amount;
    if (e.paymentGroup === 'alternative') byCategoryMap[key].alternative += e.amount;
    else byCategoryMap[key].traditional += e.amount;
  }
  const byCategory = Object.values(byCategoryMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // Entrate per categoria
  const byIncomeCategoryMap = {};
  for (const e of curExpenses.filter(e => e.type === 'income')) {
    const key   = e.categoryId?._id?.toString() || 'uncategorized';
    const name  = e.categoryId?.name  || 'Senza categoria';
    const color = e.categoryId?.color || '#94a3b8';
    if (!byIncomeCategoryMap[key]) byIncomeCategoryMap[key] = { name, color, amount: 0 };
    byIncomeCategoryMap[key].amount += e.amount;
  }
  const byIncomeCategory = Object.values(byIncomeCategoryMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // Metodi pagamento (solo uscite)
  const byMethodMap = {};
  for (const e of curExpenses.filter(e => e.type !== 'income')) {
    if (!byMethodMap[e.paymentMethod]) byMethodMap[e.paymentMethod] = 0;
    byMethodMap[e.paymentMethod] += e.amount;
  }
  const byMethod = Object.entries(byMethodMap)
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Tradizionale vs Alternativo
  const traditional = curExpenses
    .filter(e => e.type !== 'income' && e.paymentGroup === 'traditional')
    .reduce((s, e) => s + e.amount, 0);
  const alternative = curExpenses
    .filter(e => e.type !== 'income' && e.paymentGroup === 'alternative')
    .reduce((s, e) => s + e.amount, 0);

  // Ultimi 6 mesi — andamento uscite/entrate
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const from = `${y}-${String(m).padStart(2,'0')}-01`;
    const to   = `${y}-${String(m).padStart(2,'0')}-31`;
    const docs = await Movement.find({ date: { $gte: from, $lte: to }, ...excludeFilter }).lean();
    trend.push({
      label: `${String(m).padStart(2,'0')}/${y}`,
      expense: docs.filter(e => e.type !== 'income').reduce((s,e) => s + e.amount, 0),
      income:  docs.filter(e => e.type === 'income').reduce((s,e) => s + e.amount, 0),
    });
  }

  return NextResponse.json({
    month, year,
    current:  { totalExpense: curTotalExpense,  totalIncome: curTotalIncome,  count: curExpenses.length },
    previous: { totalExpense: prevTotalExpense, totalIncome: prevTotalIncome },
    byCategory,
    byIncomeCategory,
    byMethod,
    paymentGroups: { traditional, alternative },
    trend,
  });
}
