/**
 * @fileoverview API route — /api/movimenti/[id]/split
 * POST — divide un movimento in due: il movimento resta come prima parte, la seconda diventa un
 * movimento nuovo con la sua categoria (lib/utils/split.js).
 *
 * Body: {
 *   movement:  i campi della prima parte, come per PUT /api/movimenti/[id] (amount = prima parte),
 *   part:      { amount, categoryId, subCategory1Id, subCategory2Id, description, notes },
 *   updatedAt: l'updatedAt del movimento quando il modulo è stato aperto
 * }
 *
 * La seconda parte copia dalla prima data, ora, metodo, esercente, luogo, tipo, origine ed
 * esclusione dalle analisi; non il collegamento a un obiettivo, che resta sulla prima.
 *
 * Mongo può girare senza replica set, quindi senza transazioni: prima si crea la seconda parte,
 * poi si aggiorna la prima solo se nessuno l'ha cambiata nel frattempo; se non riesce, la seconda
 * parte si elimina. Non restano mai parti che non sommano all'originale.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { movementInput } from '@/lib/utils/movementInput';
import { splitInfo, toCents } from '@/lib/utils/split';
import { writeAudit } from '@/lib/utils/audit';
import { logApiError } from '@/lib/logger';
import { serverTranslator } from '@/lib/i18n/server';

export async function POST(req, { params }) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  const tErrors = await serverTranslator('errors');
  const fail = (key, status = 400) => NextResponse.json({ error: tErrors(key) }, { status });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail('movementNotFound', 404);

  const body = await req.json().catch(() => null);
  const first = movementInput(body?.movement);
  if (first.error) return fail(first.error);

  const part = body?.part;
  if (!part || typeof part !== 'object') return fail('invalidSplit');
  // La seconda parte passa dalla stessa validazione: stessi campi della prima, con i suoi.
  const second = movementInput({
    ...first.data,
    amount: part.amount,
    description: part.description ?? '',
    notes: part.notes ?? '',
    categoryId: part.categoryId || null,
    subCategory1Id: part.subCategory1Id || null,
    subCategory2Id: part.subCategory2Id || null,
    goalId: null,
    goalItemId: null,
  });
  if (second.error) return fail(second.error);

  await connectDB();
  const stored = await Movement.findById(id).lean();
  if (!stored) return fail('movementNotFound', 404);
  const openedAt = new Date(body?.updatedAt);
  if (Number.isNaN(openedAt.getTime()) || openedAt.getTime() !== new Date(stored.updatedAt).getTime()) {
    return fail('movementChanged', 409);
  }

  const split = splitInfo(stored, randomUUID());
  const total = toCents(first.data.amount) + toCents(second.data.amount);

  let created;
  try {
    created = await Movement.create({
      ...second.data,
      bankCategory: stored.bankCategory ?? '',
      source: stored.source,
      importMethod: stored.importMethod ?? null,
      importBatchId: stored.importBatchId ?? null,
      split,
    });
  } catch (err) {
    logApiError('POST /api/movimenti/[id]/split (create)', err, { id });
    return fail('movementSaveFailed', 500);
  }

  let updated = null;
  try {
    updated = await Movement.findOneAndUpdate(
      { _id: id, updatedAt: stored.updatedAt },
      { $set: { ...first.data, split } },
      { returnDocument: 'after', runValidators: true },
    );
  } catch (err) {
    logApiError('POST /api/movimenti/[id]/split (update)', err, { id });
  }
  if (!updated) {
    await Movement.deleteOne({ _id: created._id }).catch(() => {});
    return fail('movementChanged', 409);
  }

  const euro = (cents) => `€${(cents / 100).toFixed(2)}`;
  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'movement',
    resourceId: id,
    description: `Diviso movimento ${euro(total)} in ${euro(toCents(updated.amount))} + ${euro(toCents(created.amount))}${updated.payee ? ` — ${updated.payee}` : ''}`,
    meta: { splitGroupId: split.groupId, partId: String(created._id), date: updated.date },
  });
  await writeAudit(session, req, {
    action: 'CREATE',
    resource: 'movement',
    resourceId: String(created._id),
    description: `Nuova parte di un movimento diviso: €${created.amount.toFixed(2)}${created.payee ? ` — ${created.payee}` : ''}`,
    meta: { splitGroupId: split.groupId, from: id, date: created.date },
  });

  return NextResponse.json({ movement: updated, part: created });
}
