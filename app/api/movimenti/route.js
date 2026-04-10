/**
 * @fileoverview API route — /api/movimenti
 * GET  — paginated, filtered list of expenses/incomes.
 * POST — create a new expense/income record.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { getPaymentGroup } from '@/lib/utils/payments';
import logger, { logApiError } from '@/lib/logger';
import { writeAudit } from '@/lib/utils/audit';

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
  const incomplete    = searchParams.get('incomplete') === '1';

  const SORT_FIELDS = { date: 'date', payee: 'payee', amount: 'amount' };
  const sortField = SORT_FIELDS[searchParams.get('sort')] || 'date';
  const sortDir   = searchParams.get('sortDir') === 'asc' ? 1 : -1;

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
  if (incomplete) {
    filter.categoryId = null;
  }

  const [expenses, total] = await Promise.all([
    Movement.find(filter)
      .populate('categoryId', 'name color')
      .populate('subCategory1Id', 'name')
      .populate('subCategory2Id', 'name')
      .sort({ [sortField]: sortDir, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Movement.countDocuments(filter),
  ]);

  logger.info('GET /api/movimenti', { total, page, limit, userId: session.user?.id });
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

  try {
    const expense = await Movement.create(body);
    logger.info('POST /api/movimenti', { id: expense._id, type: expense.type, userId: session.user?.id });
    await writeAudit(session, req, {
      action: 'CREATE',
      resource: 'movement',
      resourceId: expense._id,
      description: `Creato movimento €${expense.amount.toFixed(2)}${expense.payee ? ` — ${expense.payee}` : ''}${expense.description ? ` (${expense.description})` : ''}`,
      meta: { type: expense.type, paymentMethod: expense.paymentMethod, date: expense.date },
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    logApiError('POST /api/movimenti', err, { userId: session.user?.id });
    return NextResponse.json({ error: 'Errore salvataggio movimento' }, { status: 500 });
  }
}
