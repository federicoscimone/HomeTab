/**
 * @fileoverview API route — /api/scadenze/proposte
 * GET — spese che si ripetono a intervalli regolari (bollette, abbonamenti, bollo, polizze, TARI…)
 * e non sono ancora una scadenza, quelle quasi riconosciute con il motivo, e cosa è stato
 * analizzato. Nessuna IA: vedi analyzePeriodic().
 * POST { ignore: "<chiave>" } — «Ignora»: quella proposta non torna più.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { dismissSuggestion, suggestDeadlines } from '@/lib/services/deadlines';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET() {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  return NextResponse.json(await suggestDeadlines());
}

export async function POST(req) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (typeof body?.ignore !== 'string' || !body.ignore.trim() || body.ignore.length > 120) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }
  await connectDB();
  await dismissSuggestion(body.ignore.trim(), session.user.id);
  return NextResponse.json({ ok: true });
}
