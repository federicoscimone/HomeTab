import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { getPaymentGroup } from '@/lib/utils/payments';
import { writeAudit } from '@/lib/utils/audit';

export async function GET(req, { params }) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();
  const { id } = await params;
  const expense = await Movement.findById(id)
    .populate('categoryId', 'name color')
    .populate('subCategory1Id', 'name')
    .populate('subCategory2Id', 'name')
    .lean();

  if (!expense) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PUT(req, { params }) {
  const { session, denied } = await requirePermission('movements:edit');
  if (denied) return denied;

  await connectDB();
  const { id } = await params;
  const body = await req.json();

  body.paymentGroup = getPaymentGroup(body.paymentMethod);
  if (!body.type) body.type = 'expense';
  if (!body.subCategory1Id) body.subCategory1Id = null;
  if (!body.subCategory2Id) body.subCategory2Id = null;
  if (!body.categoryId)     body.categoryId = null;
  // Solo un'uscita tradizionale può pagare un obiettivo: è l'unica che entra nel risparmio.
  if (!body.goalId || body.type !== 'expense' || body.paymentGroup !== 'traditional') body.goalId = null;

  const expense = await Movement.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!expense) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });

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

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const expense = await Movement.findByIdAndUpdate(id, { $set: body }, { new: true });
  if (!expense) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });

  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'movement',
    resourceId: id,
    description: `Aggiornato movimento €${expense.amount.toFixed(2)}${expense.payee ? ` — ${expense.payee}` : ''}`,
    meta: { fields: Object.keys(body) },
  });
  return NextResponse.json(expense);
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('movements:delete');
  if (denied) return denied;

  await connectDB();
  const { id } = await params;
  const expense = await Movement.findByIdAndDelete(id);
  if (!expense) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });

  await writeAudit(session, req, {
    action: 'DELETE',
    resource: 'movement',
    resourceId: id,
    description: `Eliminato movimento €${expense.amount.toFixed(2)}${expense.payee ? ` — ${expense.payee}` : ''}${expense.description ? ` (${expense.description})` : ''}`,
    meta: { type: expense.type, date: expense.date },
  });
  return NextResponse.json({ message: 'Eliminata' });
}
