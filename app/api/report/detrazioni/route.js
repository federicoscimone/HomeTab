/**
 * @fileoverview API route — /api/report/detrazioni
 * GET ?year=  — le spese detraibili dell'anno per tipo, con il controllo sul pagamento e
 *               l'elenco dei movimenti. Vedi lib/services/deductions.js.
 * PUT { movementId, deduction } — esclude un movimento ('none'), gli dà un tipo, o lo riporta
 *               alla categoria (null).
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { deductionReport } from '@/lib/services/deductions';
import { DEDUCTION_TYPES } from '@/lib/utils/deductions';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET(req) {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  const year = Number(new URL(req.url).searchParams.get('year')) || new Date().getFullYear() - 1;
  if (year < 2000 || year > 2100) return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  await connectDB();
  return NextResponse.json(await deductionReport({ year }));
}

export async function PUT(req) {
  const { denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const ok = mongoose.isValidObjectId(body?.movementId)
    && (body.deduction === null || body.deduction === 'none' || DEDUCTION_TYPES.includes(body.deduction));
  if (!ok) return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  await connectDB();
  const updated = await Movement.updateOne({ _id: body.movementId, type: 'expense' }, { $set: { deduction: body.deduction } });
  if (!updated.matchedCount) return NextResponse.json({ error: (await serverTranslator('errors'))('movementNotFound') }, { status: 404 });
  return NextResponse.json({ ok: true });
}
