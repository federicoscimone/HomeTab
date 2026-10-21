/**
 * @fileoverview I segnali di risparmio della famiglia, pronti per la pagina, la chat e l'IA.
 * @module lib/services/insights
 *
 * Calcoli in lib/utils/insights.js; qui si caricano i movimenti, si tolgono i segnali giudicati
 * non utili e si aggiungono nomi, link di verifica e l'effetto sull'obiettivo più indietro.
 * Niente parte da solo: i segnali si calcolano quando qualcuno li chiede.
 */

import AdviceFeedback, { HIDE_DAYS } from '../models/AdviceFeedback.js';
import Category from '../models/Category.js';
import Movement from '../models/Movement.js';
import { getGoalsOverview } from './goals.js';
import { istatComparison } from './istatCompare.js';
import { addMonths, dayOf, monthOf } from '../utils/goalMath.js';
import {
  anomalySignals, goalImpact, growthSignals, istatSignals, rankSignals, recurringSignals,
} from '../utils/insights.js';

/** Segnali passati al modello: abbastanza per scegliere, non tanti da gonfiare la richiesta. */
export const MAX_FOR_MODEL = 12;

const listLink = (params) => `/movimenti?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}`;

/**
 * L'obiettivo a cui un risparmio servirebbe di più: fra quelli che anticiperebbe almeno di un
 * mese, prima quelli in ritardo, poi quello che ne guadagna di più.
 */
function bestGoalImpact(goals, monthly, currentMonth) {
  let best = null;
  for (const g of goals) {
    if (g.status !== 'active') continue;
    const impact = goalImpact(g.projection, monthly, currentMonth);
    if (!impact) continue;
    const rank = [g.state === 'behind' ? 1 : 0, impact.monthsEarlier ?? Infinity];
    if (!best || rank[0] > best.rank[0] || (rank[0] === best.rank[0] && rank[1] > best.rank[1])) {
      best = { rank, goal: { name: g.name, ...impact } };
    }
  }
  return best?.goal ?? null;
}

function linkFor(s) {
  if (s.kind === 'recurring') return listLink({ search: s.merchant.split(' ')[0], from: s.from, to: s.to, type: 'expense' });
  if (s.kind === 'istat') return '/report/famiglie-simili';
  return listLink({ from: s.from, to: s.to, categoryIds: s.categoryId, type: 'expense', inAnalysis: '1' });
}

/**
 * @param {{ now?: Date }} [options]
 * @returns {Promise<{ signals: object[], hiddenCount: number, istatYear: number|null, feedback: { kind: string, useful: boolean }[] }>}
 *   Tutti i segnali visibili, in ordine di risparmio possibile.
 */
export async function loadSignals({ now = new Date() } = {}) {
  const today = dayOf(now);
  const currentMonth = monthOf(now);
  const since = new Date(now.getTime() - HIDE_DAYS * 86_400_000);
  const [movements, categories, comparison, overview, feedback] = await Promise.all([
    Movement.find({ type: 'expense', excludeFromAnalysis: { $ne: true }, date: { $gte: `${addMonths(currentMonth, -15)}-01`, $lte: today } })
      .select('date amount payee description categoryId').lean(),
    Category.find({ level: 1 }).select('name').lean(),
    istatComparison({ now }),
    getGoalsOverview(now),
    AdviceFeedback.find().select('kind useful updatedAt').lean(),
  ]);
  const rows = movements.map((m) => ({ ...m, categoryId: m.categoryId ? String(m.categoryId) : null }));
  const names = new Map(categories.map((c) => [String(c._id), c.name]));
  const hidden = new Set(feedback.filter((f) => !f.useful && f.updatedAt >= since).map((f) => f._id));

  const all = [
    ...recurringSignals(rows, { today }),
    ...growthSignals(rows, { today }),
    ...anomalySignals(rows, { today }),
    // Senza profilo il confronto è con la media italiana: troppo vago per un consiglio.
    ...(comparison.profileComplete ? istatSignals(comparison) : []),
  ];
  const visible = rankSignals(all, { hidden });

  return {
    signals: visible.map((s) => ({
      ...s,
      categoryName: s.categoryId ? names.get(s.categoryId) ?? null : null,
      link: linkFor(s),
      goal: s.monthlySaving ? bestGoalImpact(overview.goals, s.monthlySaving, currentMonth) : null,
    })),
    hiddenCount: all.length - visible.length,
    istatYear: comparison.profileComplete ? comparison.istatYear : null,
    feedback: feedback.map((f) => ({ kind: f.kind, useful: f.useful })),
  };
}

export { rankSignals };
