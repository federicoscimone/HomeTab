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
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { monthSummary } from '@/lib/services/reports';

export async function GET(req) {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();
  // Etichetta dei movimenti senza categoria: è testo dell'interfaccia, quindi nella lingua della richiesta.
  const uncategorized = (await serverTranslator('reports'))('uncategorized');

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year  = parseInt(searchParams.get('year')  || now.getFullYear(), 10);
  const month = parseInt(searchParams.get('month') || now.getMonth() + 1, 10);
  const paymentGroupParam = searchParams.get('paymentGroup') || 'traditional';
  const paymentGroup = ['traditional', 'alternative', 'all'].includes(paymentGroupParam) ? paymentGroupParam : 'traditional';

  return NextResponse.json(await monthSummary({ year, month, paymentGroup, uncategorized }));
}
