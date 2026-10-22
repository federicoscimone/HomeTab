/**
 * @fileoverview API route — /api/movimenti/rapido
 * POST { text } — la bozza di un movimento da una riga («12,50 pizza»): importo, data, metodo,
 * descrizione e categoria. Non salva nulla: la pagina riempie il modulo. Vedi
 * lib/services/quickEntry.js.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { draftFromText } from '@/lib/services/quickEntry';
import { serverTranslator } from '@/lib/i18n/server';

export async function POST(req) {
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const tErrors = await serverTranslator('errors');
  if (typeof body?.text !== 'string' || !body.text.trim() || body.text.length > 200) {
    return NextResponse.json({ error: tErrors('invalidData') }, { status: 400 });
  }
  await connectDB();
  const draft = await draftFromText(body.text, session.user.id);
  if (!draft) return NextResponse.json({ error: tErrors('quickEntryNoAmount') }, { status: 422 });
  return NextResponse.json({ draft });
}
