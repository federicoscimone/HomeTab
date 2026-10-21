/**
 * @fileoverview API route — /api/consigli/feedback
 * POST { key, kind, useful } — il giudizio su un consiglio. «Non utile» nasconde quel segnale per
 * sei mesi (vedi lib/models/AdviceFeedback.js); un nuovo giudizio sostituisce il precedente.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import AdviceFeedback from '@/lib/models/AdviceFeedback';
import { serverTranslator } from '@/lib/i18n/server';

const KINDS = ['recurring', 'growth', 'anomaly', 'istat'];

export async function POST(req) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const { key, kind, useful } = body ?? {};
  if (typeof key !== 'string' || !key.startsWith(`${kind}:`) || key.length > 200 || !KINDS.includes(kind) || typeof useful !== 'boolean') {
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }
  await connectDB();
  await AdviceFeedback.updateOne({ _id: key }, { $set: { kind, useful, updatedBy: session.user.id } }, { upsert: true });
  return NextResponse.json({ ok: true });
}
