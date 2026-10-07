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
 *   compare    {string} - 'period' (default) | 'full': base del confronto quando il periodo è
 *                         in corso. Vedi lib/utils/comparePeriods.js.
 *
 * Response: { year, type, month?, compare, cutoff, categories[] } where each category has:
 *   - totalCur, totalPrevToDate, totalPrevFull, e totalPrev / deltaAbs / deltaPct calcolati
 *     sulla base scelta con `compare`
 *   - If month not set: monthly[] e avg. In monthly, cur è null per i mesi successivi a oggi, e
 *     il mese in corso ha partial: true e prevToDate (l'anno prima fino allo stesso giorno)
 *
 * `cutoff` è la data di oggi se il periodo scelto è in corso, altrimenti null: in quel caso le
 * due basi di confronto coincidono.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import Category from '@/lib/models/Category';
import { comparisonPeriods, todayString } from '@/lib/utils/comparePeriods';

export async function GET(req) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const year       = parseInt(searchParams.get('year') || new Date().getFullYear());
  const categoryId = searchParams.get('categoryId') || null;
  const type       = searchParams.get('type') || 'expense';
  const paymentGroup = searchParams.get('paymentGroup') || '';
  const month      = searchParams.get('month') ? parseInt(searchParams.get('month')) : null;
  const compare    = searchParams.get('compare') === 'full' ? 'full' : 'period';

  const periods = comparisonPeriods(year, month, todayString());
  const cutoffMonth = periods.cutoff ? parseInt(periods.cutoff.split('-')[1]) : 13;

  const categories = await Category.find({ level: 1 }).sort({ name: 1 }).lean();

  // Per ogni categoria calcola: mensile anno corrente + anno precedente
  const result = [];

  const catsToProcess = categoryId
    ? categories.filter(c => c._id.toString() === categoryId)
    : categories;

  for (const cat of catsToProcess) {
    const baseFilter = {
      $or: [{ categoryId: cat._id }, { subCategory1Id: cat._id }],
      type,
      excludeFromAnalysis: { $ne: true },
    };
    if (paymentGroup) baseFilter.paymentGroup = paymentGroup;

    const [curExp, prevExp] = await Promise.all([
      Movement.find({
        ...baseFilter,
        date: { $gte: periods.current.from, $lte: periods.current.to },
      }).lean(),
      Movement.find({
        ...baseFilter,
        date: { $gte: periods.previousFull.from, $lte: periods.previousFull.to },
      }).lean(),
    ]);

    if (curExp.length === 0 && prevExp.length === 0) continue;

    const totalCur        = curExp .reduce((s,e) => s + e.amount, 0);
    const totalPrevFull   = prevExp.reduce((s,e) => s + e.amount, 0);
    const totalPrevToDate = prevExp
      .filter(e => e.date <= periods.previousToDate.to)
      .reduce((s,e) => s + e.amount, 0);
    const totalPrev = compare === 'full' ? totalPrevFull : totalPrevToDate;

    const catResult = {
      categoryId:   cat._id.toString(),
      categoryName: cat.name,
      color:        cat.color,
      totalCur,
      totalPrev,
      totalPrevToDate,
      totalPrevFull,
      deltaAbs: totalCur - totalPrev,
      deltaPct: totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null,
    };

    // Se non è filtro per mese, aggiungi il breakdown mensile e media
    if (!month) {
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        // I mesi dopo oggi non sono a zero: non sono ancora arrivati.
        const cur  = m > cutoffMonth
          ? null
          : curExp.filter(e => parseInt(e.date.split('-')[1]) === m).reduce((s,e) => s + e.amount, 0);
        const prevOfMonth = prevExp.filter(e => parseInt(e.date.split('-')[1]) === m);
        const prev = prevOfMonth.reduce((s,e) => s + e.amount, 0);
        if (m !== cutoffMonth) return { month: m, cur, prev };
        // Il mese in corso porta anche l'anno prima fino allo stesso giorno, per confrontarlo alla pari.
        const prevToDate = prevOfMonth
          .filter(e => e.date <= periods.previousToDate.to)
          .reduce((s,e) => s + e.amount, 0);
        return { month: m, cur, prev, prevToDate, partial: true };
      });
      const monthsWithData = monthly.filter(m => m.cur > 0).length || 1;
      catResult.monthly = monthly;
      catResult.avg = totalCur / monthsWithData;
    }

    result.push(catResult);
  }

  result.sort((a, b) => b.totalCur - a.totalCur);

  const response = { year, type, compare, cutoff: periods.cutoff, categories: result };
  if (paymentGroup) response.paymentGroup = paymentGroup;
  if (month) response.month = month;

  return NextResponse.json(response);
}
