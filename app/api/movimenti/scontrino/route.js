/**
 * @fileoverview API route — /api/movimenti/scontrino
 * GET  — se la lettura degli scontrini è disponibile (serve l'IA).
 * POST { image, mediaType } — la bozza di un movimento dalla foto di uno scontrino. La foto parte
 *        verso il modello e non si salva; la pagina riempie il modulo. Il browser la rimpicciolisce
 *        prima dell'invio, a 2.000 px di lato: poche centinaia di KB.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { AiError } from '@/lib/ai';
import { draftFromReceipt, RECEIPT_TYPES, receiptAvailability } from '@/lib/services/quickEntry';
import { serverTranslator } from '@/lib/i18n/server';

/** 4 MB di base64: sotto il limite delle richieste di Vercel (4,5 MB), molto sopra una foto ridotta. */
const MAX_BASE64 = 4 * 1024 * 1024;

export async function GET() {
  const { denied } = await requirePermission('movements:create');
  if (denied) return denied;
  await connectDB();
  return NextResponse.json(await receiptAvailability());
}

export async function POST(req) {
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;
  const tErrors = await serverTranslator('errors');
  const body = await req.json().catch(() => null);
  const valid = typeof body?.image === 'string' && body.image.length <= MAX_BASE64
    && /^[A-Za-z0-9+/=]+$/.test(body.image.slice(0, 200)) && RECEIPT_TYPES.includes(body.mediaType);
  if (!valid) return NextResponse.json({ error: tErrors('invalidData') }, { status: 400 });

  await connectDB();
  try {
    const draft = await draftFromReceipt({ data: body.image, mediaType: body.mediaType }, session.user.id);
    if (!draft) return NextResponse.json({ error: tErrors('notAReceipt') }, { status: 422 });
    return NextResponse.json({ draft });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    const status = err.code === 'budget' ? 429 : err.code === 'unavailable' ? 409 : 502;
    return NextResponse.json({ error: tErrors(err.code === 'budget' ? 'aiBudget' : 'aiUnavailable') }, { status });
  }
}
