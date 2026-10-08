import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { movementInput, movementPatchInput } from '@/lib/utils/movementInput';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

/** Un id malformato è un movimento che non esiste: 404, non l'errore di cast di Mongoose (500). */
async function notFound() {
  return NextResponse.json({ error: (await serverTranslator('errors'))('movementNotFound') }, { status: 404 });
}

/** @param {string} key - Chiave del namespace "errors". */
async function badRequest(key) {
  return NextResponse.json({ error: (await serverTranslator('errors'))(key) }, { status: 400 });
}

export async function GET(req, { params }) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  await connectDB();
  const expense = await Movement.findById(id)
    .populate('categoryId', 'name color')
    .populate('subCategory1Id', 'name')
    .populate('subCategory2Id', 'name')
    .lean();

  if (!expense) return notFound();
  return NextResponse.json(expense);
}

export async function PUT(req, { params }) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  const { data, error } = movementInput(await req.json().catch(() => null));
  if (error) return badRequest(error);

  await connectDB();
  const expense = await Movement.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
  if (!expense) return notFound();

  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'movement',
    resourceId: id,
    description: `Modificato movimento €${expense.amount.toFixed(2)}${expense.payee ? ` — ${expense.payee}` : ''}${expense.description ? ` (${expense.description})` : ''}`,
    meta: { type: expense.type, paymentMethod: expense.paymentMethod, date: expense.date },
  });
  return NextResponse.json(expense);
}

export async function PATCH(req, { params }) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  const { data, error } = movementPatchInput(await req.json().catch(() => null));
  if (error) return badRequest(error);

  await connectDB();
  const expense = await Movement.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' });
  if (!expense) return notFound();

  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'movement',
    resourceId: id,
    description: `Aggiornato movimento €${expense.amount.toFixed(2)}${expense.payee ? ` — ${expense.payee}` : ''}`,
    meta: { fields: Object.keys(data) },
  });
  return NextResponse.json(expense);
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('movements:delete');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  await connectDB();
  const expense = await Movement.findByIdAndDelete(id);
  if (!expense) return notFound();

  await writeAudit(session, req, {
    action: 'DELETE',
    resource: 'movement',
    resourceId: id,
    description: `Eliminato movimento €${expense.amount.toFixed(2)}${expense.payee ? ` — ${expense.payee}` : ''}${expense.description ? ` (${expense.description})` : ''}`,
    meta: { type: expense.type, date: expense.date },
  });
  return NextResponse.json({ message: (await serverTranslator('apiMessages'))('movementDeleted') });
}
