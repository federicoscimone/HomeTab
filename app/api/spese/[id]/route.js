import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import { getPaymentGroup } from '@/lib/utils/payments';

export async function GET(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const expense = await Expense.findById(id)
    .populate('categoryId', 'name color')
    .populate('subCategory1Id', 'name')
    .populate('subCategory2Id', 'name')
    .lean();

  if (!expense) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PUT(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const body = await req.json();

  body.paymentGroup = getPaymentGroup(body.paymentMethod);
  if (!body.type) body.type = 'expense';
  if (!body.subCategory1Id) body.subCategory1Id = null;
  if (!body.subCategory2Id) body.subCategory2Id = null;
  if (!body.categoryId)     body.categoryId = null;

  const expense = await Expense.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!expense) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });
  return NextResponse.json(expense);
}

export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const expense = await Expense.findByIdAndDelete(id);
  if (!expense) return NextResponse.json({ error: 'Non trovata' }, { status: 404 });
  return NextResponse.json({ message: 'Eliminata' });
}
