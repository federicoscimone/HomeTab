/**
 * @fileoverview API route — /api/obiettivi/[id]
 * GET    — dettaglio di un obiettivo: serie mensile, proiezione e spese collegate.
 * PATCH  — modifica dei campi ({ name, targetAmount, deadline, initialAmount }) oppure cambio di
 *          stato ({ action: 'complete' | 'cancel' | 'reopen', transferTo? }).
 * DELETE — solo per un obiettivo creato nel mese in corso e senza spese collegate, cioè per
 *          correggere un errore: in tutti gli altri casi ha una storia e va annullato.
 */

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Goal from '@/lib/models/Goal';
import AllocationPlan from '@/lib/models/AllocationPlan';
import Movement from '@/lib/models/Movement';
import { getGoalsOverview, parseGoalFields } from '@/lib/services/goals';
import { monthOf } from '@/lib/utils/goalMath';
import { logApiError } from '@/lib/logger';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

/** @param {string} key - Chiave del namespace "errors". */
const fail = async (key, status) =>
  NextResponse.json({ error: (await serverTranslator('errors'))(key) }, { status });
const notFound = () => fail('goalNotFound', 404);

export async function GET(req, { params }) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  try {
    const overview = await getGoalsOverview();
    const goal = overview.goals.find((g) => g.id === id);
    if (!goal) return notFound();

    const linkedMovements = await Movement.find({ goalId: id })
      .select('date amount payee description paymentMethod paymentGroup type excludeFromAnalysis')
      .sort({ date: -1 })
      .lean();

    return NextResponse.json({
      goal,
      linkedMovements,
      currentMonth: overview.currentMonth,
      avgSavings: overview.avgSavings,
      avgMonths: overview.avgMonths,
      // Per la scelta dell'obiettivo a cui girare il disponibile in caso di annullamento.
      otherActiveGoals: overview.goals
        .filter((g) => g.status === 'active' && g.id !== id)
        .map((g) => ({ id: g.id, name: g.name })),
    });
  } catch (err) {
    logApiError('GET /api/obiettivi/[id]', err, { userId: session.user?.id, id });
    return fail('goalComputeFailed', 500);
  }
}

export async function PATCH(req, { params }) {
  const { session, denied } = await requirePermission('goals:manage');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  await connectDB();
  const goal = await Goal.findById(id);
  if (!goal) return notFound();

  const body = (await req.json().catch(() => null)) ?? {};
  const currentMonth = monthOf(new Date());
  let description;

  if (body.action === 'complete' || body.action === 'cancel') {
    if (goal.status !== 'active') return fail('goalAlreadyClosed', 409);

    let transferTo = null;
    if (body.action === 'cancel' && body.transferTo) {
      const target = mongoose.isValidObjectId(body.transferTo)
        ? await Goal.findOne({ _id: body.transferTo, status: 'active' }).lean()
        : null;
      if (!target || String(target._id) === id) {
        return fail('invalidTransferTarget', 400);
      }
      transferTo = target._id;
      description = `Annullato obiettivo "${goal.name}", disponibile girato a "${target.name}"`;
    }

    goal.status = body.action === 'complete' ? 'completed' : 'cancelled';
    goal.closedMonth = currentMonth;
    goal.transferTo = transferTo;
    description ??= body.action === 'complete'
      ? `Concluso obiettivo "${goal.name}"`
      : `Annullato obiettivo "${goal.name}", disponibile al risparmio libero`;
  } else if (body.action === 'reopen') {
    if (goal.status === 'active') return fail('goalAlreadyActive', 409);
    goal.status = 'active';
    goal.closedMonth = null;
    goal.transferTo = null;
    description = `Riaperto obiettivo "${goal.name}"`;
  } else if (body.action) {
    return fail('invalidAction', 400);
  } else {
    if (goal.status !== 'active') return fail('goalClosedNoEdit', 409);
    // La scadenza già fissata può restare nel passato (obiettivo scaduto), ma una nuova no.
    const fields = { ...body };
    if (fields.deadline === goal.deadline) delete fields.deadline;
    const { data, error } = parseGoalFields(fields, currentMonth, true);
    if (error) return fail(error, 400);
    Object.assign(goal, data);
    description = `Modificato obiettivo "${goal.name}"`;
  }

  try {
    await goal.save();
    await writeAudit(session, req, {
      action: 'UPDATE',
      resource: 'goal',
      resourceId: id,
      description,
      meta: { action: body.action ?? 'edit', status: goal.status },
    });
    return NextResponse.json(goal);
  } catch (err) {
    logApiError('PATCH /api/obiettivi/[id]', err, { userId: session.user?.id, id });
    return fail('goalSaveFailed', 500);
  }
}

export async function DELETE(req, { params }) {
  const { session, denied } = await requirePermission('goals:manage');
  if (denied) return denied;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return notFound();

  await connectDB();
  const goal = await Goal.findById(id).lean();
  if (!goal) return notFound();

  const currentMonth = monthOf(new Date());
  const [linked, referencedBy] = await Promise.all([
    Movement.countDocuments({ goalId: id }),
    Goal.countDocuments({ transferTo: id }),
  ]);
  if (goal.createdMonth !== currentMonth || linked > 0 || referencedBy > 0) {
    return fail('goalHasHistory', 409);
  }

  // Un obiettivo creato questo mese può comparire solo nella versione del piano del mese in corso.
  await AllocationPlan.updateMany({ effectiveFrom: { $gte: currentMonth } }, { $pull: { shares: { goalId: goal._id } } });
  await Goal.deleteOne({ _id: id });

  await writeAudit(session, req, {
    action: 'DELETE',
    resource: 'goal',
    resourceId: id,
    description: `Eliminato obiettivo "${goal.name}"`,
  });
  return NextResponse.json({ message: (await serverTranslator('apiMessages'))('goalDeleted') });
}
