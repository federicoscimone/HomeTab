/**
 * @fileoverview API route — /api/report/istat
 * GET — le spese della famiglia per capitolo, in media mensile sugli ultimi 12 mesi completi,
 * accanto alla media ISTAT per la regione e il numero di componenti del profilo.
 * Vedi lib/services/istatCompare.js.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { istatComparison } from '@/lib/services/istatCompare';

export async function GET() {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  return NextResponse.json(await istatComparison());
}
