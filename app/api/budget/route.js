/**
 * @fileoverview API route — /api/budget
 * GET — i budget del mese con speso, percentuale e stima a fine mese, più le categorie con la
 *       media degli ultimi 3 mesi e il budget suggerito.
 * PUT { budgets: [{ categoryId, amount }] } — imposta i budget; amount null toglie quello della
 *       categoria. Vedi lib/services/budgets.js.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Budget from '@/lib/models/Budget';
import { budgetOverview } from '@/lib/services/budgets';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET() {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  return NextResponse.json(await budgetOverview());
}

export async function PUT(req) {
  const { session, denied } = await requirePermission('goals:manage');
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const list = Array.isArray(body?.budgets) ? body.budgets : null;
  const valid = list && list.length > 0 && list.length <= 100 && list.every((b) => mongoose.isValidObjectId(b?.categoryId)
    && (b.amount === null || (typeof b.amount === 'number' && b.amount >= 1 && b.amount < 1e7)));
  if (!valid) return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });

  await connectDB();
  await Budget.bulkWrite(list.map((b) => (b.amount === null
    ? { deleteOne: { filter: { categoryId: b.categoryId } } }
    : { updateOne: { filter: { categoryId: b.categoryId }, update: { $set: { amount: b.amount } }, upsert: true } })));
  await writeAudit(session, req, {
    action: 'UPDATE', resource: 'budget', resourceId: null,
    description: `Budget mensili: ${list.filter((b) => b.amount !== null).length} impostati, ${list.filter((b) => b.amount === null).length} tolti`,
  });
  return NextResponse.json(await budgetOverview());
}
