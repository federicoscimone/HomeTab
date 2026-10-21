/**
 * @fileoverview API route — /api/report/analisi
 * GET — advanced analysis for a custom date range with YoY comparison and projections.
 *
 * Query params:
 *   from {string} - Start date YYYY-MM-DD (required).
 *   to   {string} - End date YYYY-MM-DD (required).
 *   type {string} - 'expense' | 'income'.
 *   paymentGroup {string} - Optional: 'traditional' | 'alternative'.
 *
 * Response: totals, byCategory comparison, weekly breakdown, year-end projection.
 */

import { NextResponse } from 'next/server';
import { serverTranslator } from '@/lib/i18n/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { rangeAnalysis } from '@/lib/services/reports';

export async function GET(req) {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();
  // Etichetta dei movimenti senza categoria: è testo dell'interfaccia, quindi nella lingua della richiesta.
  const uncategorized = (await serverTranslator('reports'))('uncategorized');

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  if (!from || !to) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('dateRangeRequired') }, { status: 400 });
  }
  return NextResponse.json(await rangeAnalysis({
    from, to,
    type: searchParams.get('type') || 'expense',
    paymentGroup: searchParams.get('paymentGroup') || '',
    uncategorized,
  }));
}
