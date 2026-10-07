/**
 * @fileoverview API route — /api/obiettivi/ripartizione
 * PUT — salva la ripartizione del risparmio tra gli obiettivi attivi, a partire dal mese in corso.
 *
 * Body: { shares: [{ goalId, pct }] } con pct intero 0–100 e somma ≤ 100 (il resto è risparmio
 * libero). Devono comparire tutti gli obiettivi attivi non ancora raggiunti: è il vincolo che
 * obbliga a scegliere una percentuale per ogni obiettivo. Rimodificare il piano nello stesso mese
 * sostituisce la versione del mese, senza toccare quelle dei mesi già chiusi.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import AllocationPlan from '@/lib/models/AllocationPlan';
import { getGoalsOverview } from '@/lib/services/goals';
import { logApiError } from '@/lib/logger';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

export async function PUT(req) {
  const { session, denied } = await requirePermission('goals:manage');
  if (denied) return denied;

  await connectDB();
  const tErrors = await serverTranslator('errors');
  const fail = (key, values) => NextResponse.json({ error: tErrors(key, values) }, { status: 400 });
  const body = await req.json().catch(() => null);
  const shares = Array.isArray(body?.shares) ? body.shares : null;
  if (!shares) return fail('allocationMissing');

  const overview = await getGoalsOverview();
  const active = new Map(overview.goals.filter((g) => g.status === 'active').map((g) => [g.id, g]));

  const seen = new Set();
  for (const s of shares) {
    if (!active.has(s?.goalId)) {
      return fail('allocationInactiveGoal');
    }
    if (seen.has(s.goalId)) return fail('allocationDuplicateGoal');
    seen.add(s.goalId);
    if (!Number.isInteger(s.pct) || s.pct < 0 || s.pct > 100) {
      return fail('allocationInvalidPct');
    }
  }

  const total = shares.reduce((sum, s) => sum + s.pct, 0);
  if (total > 100) return fail('allocationOver100', { total });

  const missing = [...active.values()].filter((g) => g.state !== 'reached' && !seen.has(g.id));
  if (missing.length > 0) {
    return fail('allocationMissingGoals', { names: missing.map((g) => g.name).join(', ') });
  }

  try {
    const plan = await AllocationPlan.findOneAndUpdate(
      { effectiveFrom: overview.currentMonth },
      { shares: shares.map((s) => ({ goalId: s.goalId, pct: s.pct })) },
      { upsert: true, new: true, runValidators: true },
    );

    await writeAudit(session, req, {
      action: 'UPDATE',
      resource: 'goal',
      resourceId: plan._id,
      description: `Nuova ripartizione dal ${overview.currentMonth}: ${shares
        .map((s) => `${active.get(s.goalId).name} ${s.pct}%`)
        .join(', ')} — libero ${100 - total}%`,
      meta: { effectiveFrom: overview.currentMonth, shares },
    });
    return NextResponse.json(plan);
  } catch (err) {
    logApiError('PUT /api/obiettivi/ripartizione', err, { userId: session.user?.id });
    return NextResponse.json({ error: tErrors('allocationSaveFailed') }, { status: 500 });
  }
}
