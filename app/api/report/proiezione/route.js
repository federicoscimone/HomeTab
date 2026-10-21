/**
 * @fileoverview API route — /api/report/proiezione
 * GET — risparmio dell'anno finora, proiezione a fine anno e stato degli obiettivi attivi.
 * Vedi lib/services/projection.js e lib/utils/savingsProjection.js.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { yearProjection } from '@/lib/services/projection';

export async function GET() {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  return NextResponse.json(await yearProjection());
}
