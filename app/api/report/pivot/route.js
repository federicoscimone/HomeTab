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
import { serverTranslator } from '@/lib/i18n/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { pivotReport } from '@/lib/services/reports';

export async function GET(req) {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();
  // Etichetta dei movimenti senza categoria: è testo dell'interfaccia, quindi nella lingua della richiesta.
  const uncategorized = (await serverTranslator('reports'))('uncategorized');

  const { searchParams } = new URL(req.url);
  return NextResponse.json(await pivotReport({
    year:         parseInt(searchParams.get('year') || new Date().getFullYear(), 10),
    type:         searchParams.get('type') || 'expense',
    paymentGroup: searchParams.get('paymentGroup') || '',
    uncategorized,
  }));
}
