/**
 * @fileoverview Lettura dei dati per la sezione Obiettivi e composizione del calcolo.
 * @module lib/services/goals
 *
 * Il risparmio di un mese è entrate − uscite fatte con metodi di pagamento tradizionali: ticket e
 * buoni non sono denaro che si possa mettere da parte. Valgono le stesse esclusioni dei report
 * (`excludeFromAnalysis`, usato anche per i giroconti verso il conto deposito) e si contano solo
 * movimenti con data fino a oggi, perché nel database possono esistere movimenti futuri.
 */

import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import Goal from '@/lib/models/Goal';
import AllocationPlan from '@/lib/models/AllocationPlan';
import { computeGoals, monthOf, dayOf } from '@/lib/utils/goalMath';

/** Filtro comune: movimenti che contano ai fini del risparmio. */
const SAVINGS_SCOPE = { paymentGroup: 'traditional', excludeFromAnalysis: { $ne: true } };

/**
 * Risparmio netto per mese e spese collegate agli obiettivi, con una sola aggregazione.
 *
 * @param {string} today - YYYY-MM-DD.
 */
async function loadMovementTotals(today) {
  const rows = await Movement.aggregate([
    { $match: { ...SAVINGS_SCOPE, date: { $lte: today } } },
    {
      $group: {
        _id: {
          month: { $substrBytes: ['$date', 0, 7] },
          // Solo le uscite possono essere collegate: un'entrata con goalId resta un'entrata.
          goalId: { $cond: [{ $eq: ['$type', 'income'] }, null, { $ifNull: ['$goalId', null] }] },
        },
        income:  { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expense: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, 0, '$amount'] } },
      },
    },
  ]);

  const savingsByMonth = {};
  const linkedExpenses = [];
  let firstDataMonth = null;

  for (const r of rows) {
    const { month, goalId } = r._id;
    if (!firstDataMonth || month < firstDataMonth) firstDataMonth = month;
    if (goalId) {
      linkedExpenses.push({ goalId: String(goalId), month, amount: r.expense });
    } else {
      savingsByMonth[month] = (savingsByMonth[month] ?? 0) + r.income - r.expense;
    }
  }
  return { savingsByMonth, linkedExpenses, firstDataMonth };
}

/**
 * @param {object} doc - Goal lean document.
 * @returns {import('@/lib/utils/goalMath').GoalInput}
 */
function toGoalInput(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    targetAmount: doc.targetAmount,
    deadline: doc.deadline,
    initialAmount: doc.initialAmount ?? 0,
    createdMonth: doc.createdMonth,
    status: doc.status,
    closedMonth: doc.closedMonth ?? null,
    transferTo: doc.transferTo ? String(doc.transferTo) : null,
  };
}

/**
 * Stato completo della sezione Obiettivi alla data `now`.
 *
 * @param {Date} [now]
 */
export async function getGoalsOverview(now = new Date()) {
  await connectDB();
  const today = dayOf(now);
  const currentMonth = monthOf(now);

  const [goalDocs, planDocs, totals] = await Promise.all([
    Goal.find().sort({ deadline: 1, createdAt: 1 }).lean(),
    AllocationPlan.find().sort({ effectiveFrom: 1 }).lean(),
    loadMovementTotals(today),
  ]);

  const { [currentMonth]: currentMonthSavings = 0, ...closedSavings } = totals.savingsByMonth;

  return computeGoals({
    goals: goalDocs.map(toGoalInput),
    plans: planDocs.map((p) => ({
      effectiveFrom: p.effectiveFrom,
      shares: p.shares.map((s) => ({ goalId: String(s.goalId), pct: s.pct })),
    })),
    savingsByMonth: closedSavings,
    linkedExpenses: totals.linkedExpenses,
    currentMonth,
    currentMonthSavings,
    firstDataMonth: totals.firstDataMonth,
  });
}

/**
 * Valida e normalizza i campi modificabili di un obiettivo.
 *
 * @param {object}  body
 * @param {string}  currentMonth
 * @param {boolean} [partial=false] - true per le modifiche: valida solo i campi presenti.
 * @returns {{ data?: object, error?: string }} error è una chiave del namespace "errors" di
 *   messages/*.json: la traduce la route, nella lingua della richiesta.
 */
export function parseGoalFields(body, currentMonth, partial = false) {
  const data = {};
  const has = (k) => body?.[k] !== undefined;

  if (!partial || has('name')) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) return { error: 'goalNameRequired' };
    data.name = name;
  }
  if (!partial || has('targetAmount')) {
    const v = Number(body?.targetAmount);
    if (!Number.isFinite(v) || v < 1) return { error: 'goalAmountMin' };
    data.targetAmount = Math.round(v * 100) / 100;
  }
  if (!partial || has('deadline')) {
    const d = body?.deadline;
    if (typeof d !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(d)) return { error: 'goalDeadlineInvalid' };
    if (d < currentMonth) return { error: 'goalDeadlinePast' };
    data.deadline = d;
  }
  if (has('initialAmount') || !partial) {
    const v = Number(body?.initialAmount ?? 0);
    if (!Number.isFinite(v) || v < 0) return { error: 'goalInitialNegative' };
    data.initialAmount = Math.round(v * 100) / 100;
  }
  return { data };
}
