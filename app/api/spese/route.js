/**
 * @fileoverview API route — /api/spese
 * GET  — paginated, filtered list of expenses/incomes.
 * POST — create a new expense/income record.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import { getPaymentGroup } from '@/lib/utils/payments';

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page      = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit     = Math.min(100, parseInt(searchParams.get('limit') || '20'));
  const from      = searchParams.get('from');
  const to        = searchParams.get('to');
  const categoryId    = searchParams.get('categoryId');
  const paymentMethod = searchParams.get('paymentMethod');
  const paymentGroup  = searchParams.get('paymentGroup');
  const search        = searchParams.get('search');
  const type          = searchParams.get('type');

  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to)   filter.date.$lte = to;
  }
  if (categoryId)    filter.$or = [{ categoryId }, { subCategory1Id: categoryId }, { subCategory2Id: categoryId }];
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (paymentGroup)  filter.paymentGroup  = paymentGroup;
  if (type)          filter.type = type;
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ payee: rx }, { description: rx }, { place: rx }, { notes: rx }];
  }

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .populate('categoryId', 'name color')
      .populate('subCategory1Id', 'name')
      .populate('subCategory2Id', 'name')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Expense.countDocuments(filter),
  ]);

  return NextResponse.json({ expenses, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  await connectDB();

  const body = await req.json();
  body.paymentGroup = getPaymentGroup(body.paymentMethod);
  if (!body.type) body.type = 'expense';
  if (!body.subCategory1Id) body.subCategory1Id = null;
  if (!body.subCategory2Id) body.subCategory2Id = null;
  if (!body.categoryId)     body.categoryId = null;

  const expense = await Expense.create(body);
  return NextResponse.json(expense, { status: 201 });
}
