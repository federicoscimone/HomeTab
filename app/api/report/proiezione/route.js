/**
 * @fileoverview API route — /api/report/proiezione
 * GET — risparmio dell'anno finora, proiezione a fine anno e stato degli obiettivi attivi.
 * Vedi lib/services/projection.js e lib/utils/savingsProjection.js.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { yearProjection } from '@/lib/services/projection';

/** Id separati da virgola: solo quelli ben formati. */
const ids = (v) => (v ?? '').split(',').filter((x) => /^[a-f0-9]{24}$/.test(x));

/**
 * `incomeOnly` / `incomeExclude`: categorie o sottocategorie di entrata da contare o da escludere,
 * come lo strumento proiezione_anno della chat (i suoi link portano qui i numeri da verificare).
 */
export async function GET(req) {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  const q = new URL(req.url).searchParams;
  return NextResponse.json(await yearProjection({ incomeOnly: ids(q.get('incomeOnly')), incomeExclude: ids(q.get('incomeExclude')) }));
}
