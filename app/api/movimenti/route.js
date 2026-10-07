/**
 * @fileoverview API route — /api/movimenti
 * GET  — paginated, filtered list of expenses/incomes.
 * POST — create a new expense/income record.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { movementInput } from '@/lib/utils/movementInput';
import { serverTranslator } from '@/lib/i18n/server';
import logger, { logApiError } from '@/lib/logger';
import { writeAudit } from '@/lib/utils/audit';
import { buildMovementFilter } from '@/lib/utils/movementFilter';

export async function GET(req) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page      = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit     = Math.min(100, parseInt(searchParams.get('limit') || '20'));
  const SORT_FIELDS = { date: 'date', payee: 'payee', amount: 'amount' };
  const sortField = SORT_FIELDS[searchParams.get('sort')] || 'date';
  const sortDir   = searchParams.get('sortDir') === 'asc' ? 1 : -1;

  const filter = buildMovementFilter(searchParams);

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
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;

  await connectDB();

  const tErrors = await serverTranslator('errors');
  const { data, error } = movementInput(await req.json().catch(() => null));
  if (error) return NextResponse.json({ error: tErrors(error) }, { status: 400 });

  try {
    const expense = await Movement.create(data);
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
    return NextResponse.json({ error: tErrors('movementSaveFailed') }, { status: 500 });
  }
}
