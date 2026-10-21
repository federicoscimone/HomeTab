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
import { categoryReport } from '@/lib/services/reports';

export async function GET(req) {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();

  const { searchParams } = new URL(req.url);
  return NextResponse.json(await categoryReport({
    year:         parseInt(searchParams.get('year') || new Date().getFullYear(), 10),
    categoryId:   searchParams.get('categoryId') || null,
    type:         searchParams.get('type') || 'expense',
    paymentGroup: searchParams.get('paymentGroup') || '',
    month:        searchParams.get('month') ? parseInt(searchParams.get('month'), 10) : null,
    compare:      searchParams.get('compare') === 'full' ? 'full' : 'period',
  }));
}
