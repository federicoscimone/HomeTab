/**
 * @fileoverview API route — /api/dashboard
 * GET — returns monthly financial summary for the dashboard widgets.
 *
 * Query params:
 *   year  {number} - Calendar year (default: current year).
 *   month {number} - Calendar month 1–12 (default: current month).
 *   paymentGroup {string} - Optional: 'traditional' | 'alternative' | 'all' (default: 'traditional').
 *
 * Response includes: current/previous month totals, byCategory, byMethod,
 * paymentGroups breakdown, and 6-month trend.
 */

import { NextResponse } from 'next/server';
import { serverTranslator } from '@/lib/i18n/server';
import { todayString } from '@/lib/utils/comparePeriods';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import '@/lib/models/Category';

export async function GET(req) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();
  // Etichetta dei movimenti senza categoria: è testo dell'interfaccia, quindi nella lingua della richiesta.
  const uncategorized = (await serverTranslator('reports'))('uncategorized');

  const { searchParams } = new URL(req.url);
  const now    = new Date();
  const year   = parseInt(searchParams.get('year')  || now.getFullYear());
  const month  = parseInt(searchParams.get('month') || now.getMonth() + 1);
  const paymentGroupParam = searchParams.get('paymentGroup') || 'traditional';
  const paymentGroup = ['traditional', 'alternative', 'all'].includes(paymentGroupParam)
    ? paymentGroupParam
    : 'traditional';

  // Mese corrente e precedente in formato YYYY-MM-DD
  const curFrom = `${year}-${String(month).padStart(2,'0')}-01`;
  const curTo   = `${year}-${String(month).padStart(2,'0')}-31`;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevFrom  = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;

  // Mese in corso: il confronto è con gli stessi giorni del mese prima. Il 7 ottobre una settimana
  // di spese contro settembre intero dava sempre un calo (-52%), qualunque cosa fosse successo.
  // Il giorno si ferma alla fine del mese precedente: il 31 marzo si confronta con tutto febbraio.
  const today = todayString();
  const inProgress = today >= curFrom && today <= curTo;
  const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const prevToDay = inProgress ? Math.min(Number(today.slice(8)), daysInPrevMonth) : null;
  const prevTo    = `${prevYear}-${String(prevMonth).padStart(2,'0')}-${prevToDay ? String(prevToDay).padStart(2,'0') : '31'}`;

  const excludeFilter = { excludeFromAnalysis: { $ne: true } };
  const paymentGroupFilter = paymentGroup === 'all' ? {} : { paymentGroup };

  const [curExpenses, prevExpenses] = await Promise.all([
    Movement.find({ date: { $gte: curFrom, $lte: curTo }, ...excludeFilter, ...paymentGroupFilter })
      .populate('categoryId', 'name color')
      .lean(),
    Movement.find({ date: { $gte: prevFrom, $lte: prevTo }, ...excludeFilter, ...paymentGroupFilter })
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
    const name  = e.categoryId?.name  || uncategorized;
    const color = e.categoryId?.color || '#94a3b8';
    if (!byCategoryMap[key]) {
      byCategoryMap[key] = {
        categoryId: e.categoryId?._id?.toString() || null,
        name,
        color,
        amount: 0,
        traditional: 0,
        alternative: 0,
      };
    }
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
    const name  = e.categoryId?.name  || uncategorized;
    const color = e.categoryId?.color || '#94a3b8';
    if (!byIncomeCategoryMap[key]) {
      byIncomeCategoryMap[key] = {
        categoryId: e.categoryId?._id?.toString() || null,
        name,
        color,
        amount: 0,
      };
    }
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

  // Ultimi 6 mesi — andamento uscite/entrate. Una sola query per tutto l'intervallo invece di
  // una per mese: sei andate e ritorni verso Atlas pesavano sul tempo di risposta.
  // Il mese esce come YYYY-MM: il nome lo scrive il browser, nella lingua dell'interfaccia.
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 6 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}`;
  });
  const trendDocs = await Movement.find({
    date: { $gte: `${trendMonths[0]}-01`, $lte: `${trendMonths[5]}-31` }, ...excludeFilter, ...paymentGroupFilter,
  }).select('date type amount').lean();
  const trend = trendMonths.map(m => ({ month: m, expense: 0, income: 0 }));
  const trendIndex = new Map(trendMonths.map((m, i) => [m, i]));
  for (const e of trendDocs) {
    const point = trend[trendIndex.get(e.date.slice(0, 7))];
    if (!point) continue;
    if (e.type === 'income') point.income += e.amount;
    else point.expense += e.amount;
  }

  return NextResponse.json({
    month, year,
    paymentGroup,
    current:  { totalExpense: curTotalExpense,  totalIncome: curTotalIncome,  count: curExpenses.length },
    // toDay: ultimo giorno del mese precedente usato nel confronto, null se è il mese intero.
    previous: { totalExpense: prevTotalExpense, totalIncome: prevTotalIncome, toDay: prevToDay },
    byCategory,
    byIncomeCategory,
    byMethod,
    paymentGroups: { traditional, alternative },
    trend,
  });
}
