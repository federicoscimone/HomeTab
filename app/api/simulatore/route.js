/**
 * @fileoverview API route — /api/simulatore
 * GET  — la base del simulatore: categorie con la spesa media mensile, risparmio medio, obiettivi.
 * POST { changes } — l'effetto dell'ipotesi sul risparmio di fine anno, dei prossimi 12 mesi e
 *        sull'arrivo di ogni obiettivo. Senza IA: vedi lib/utils/scenario.js.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { parseChanges, runScenario, scenarioBase } from '@/lib/services/scenario';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET() {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  const { categories, baseAfter, goals, start, averageWindow } = await scenarioBase();
  return NextResponse.json({ categories, avgSavings: baseAfter, goals, start, averageWindow });
}

export async function POST(req) {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const { data, error } = parseChanges(body?.changes);
  if (error) return NextResponse.json({ error: (await serverTranslator('errors'))(error) }, { status: 400 });
  await connectDB();
  return NextResponse.json(await runScenario(data));
}
