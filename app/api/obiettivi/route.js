/**
 * @fileoverview API route — /api/obiettivi
 * GET  — stato di tutti gli obiettivi: accantonato, proiezioni, piano di ripartizione corrente,
 *        ripartizione suggerita e segnalazione degli obiettivi attivi senza quota.
 * POST — crea un nuovo obiettivo. Parte dal mese in corso: per i soldi già messi da parte
 *        si usa `initialAmount`, non una data di inizio retroattiva.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Goal from '@/lib/models/Goal';
import { getGoalsOverview, parseGoalFields } from '@/lib/services/goals';
import { monthOf } from '@/lib/utils/goalMath';
import { logApiError } from '@/lib/logger';
import { writeAudit } from '@/lib/utils/audit';

export async function GET() {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  try {
    return NextResponse.json(await getGoalsOverview());
  } catch (err) {
    logApiError('GET /api/obiettivi', err, { userId: session.user?.id });
    return NextResponse.json({ error: 'Errore nel calcolo degli obiettivi' }, { status: 500 });
  }
}

export async function POST(req) {
  const { session, denied } = await requirePermission('goals:manage');
  if (denied) return denied;

  await connectDB();
  const currentMonth = monthOf(new Date());
  const { data, error } = parseGoalFields(await req.json(), currentMonth);
  if (error) return NextResponse.json({ error }, { status: 400 });

  try {
    const goal = await Goal.create({ ...data, createdMonth: currentMonth, status: 'active' });
    await writeAudit(session, req, {
      action: 'CREATE',
      resource: 'goal',
      resourceId: goal._id,
      description: `Creato obiettivo "${goal.name}" — €${goal.targetAmount.toFixed(2)} entro ${goal.deadline}`,
      meta: { targetAmount: goal.targetAmount, deadline: goal.deadline, initialAmount: goal.initialAmount },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (err) {
    logApiError('POST /api/obiettivi', err, { userId: session.user?.id });
    return NextResponse.json({ error: 'Errore salvataggio obiettivo' }, { status: 500 });
  }
}
