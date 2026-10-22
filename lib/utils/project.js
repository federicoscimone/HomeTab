/**
 * @fileoverview Un obiettivo come progetto: voci di budget con preventivo e speso, e le cose da
 * fare. Solo calcoli, provati nei test.
 * @module lib/utils/project
 *
 * Lo speso di una voce è la somma delle spese collegate all'obiettivo con quella voce
 * (`goalItemId` sul movimento); quelle collegate senza voce, o a una voce eliminata, restano
 * «senza voce».
 */

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * @param {{ _id: any, name: string, budget: number, quote?: number|null }[]} items
 * @param {{ amount: number, goalItemId?: any }[]} movements - Spese collegate all'obiettivo.
 */
export function projectBreakdown(items, movements) {
  const spentBy = new Map();
  let unassigned = 0;
  const ids = new Set(items.map((i) => String(i._id)));
  for (const m of movements) {
    const key = m.goalItemId ? String(m.goalItemId) : null;
    if (key && ids.has(key)) spentBy.set(key, (spentBy.get(key) ?? 0) + m.amount);
    else unassigned += m.amount;
  }
  const rows = items.map((i) => {
    const spent = round2(spentBy.get(String(i._id)) ?? 0);
    return {
      id: String(i._id),
      name: i.name,
      budget: i.budget,
      quote: i.quote ?? null,
      spent,
      remaining: round2(i.budget - spent),
      // Sfora chi ha speso più del budget; chi ha un preventivo sopra il budget è a rischio.
      over: spent > i.budget + 0.005,
      quoteOver: i.quote != null && i.quote > i.budget + 0.005,
    };
  });
  const sum = (f) => round2(rows.reduce((s, r) => s + (r[f] ?? 0), 0));
  return {
    rows,
    unassigned: round2(unassigned),
    totals: { budget: sum('budget'), quote: sum('quote'), spent: round2(sum('spent') + unassigned) },
    overCount: rows.filter((r) => r.over).length,
  };
}

/**
 * @param {{ done: boolean, due?: string|null }[]} tasks
 * @param {string} today - YYYY-MM-DD.
 */
export function tasksSummary(tasks, today) {
  const open = tasks.filter((t) => !t.done);
  return {
    total: tasks.length,
    done: tasks.length - open.length,
    overdue: open.filter((t) => t.due && t.due < today).length,
    next: open.filter((t) => t.due).sort((a, b) => a.due.localeCompare(b.due))[0] ?? null,
  };
}
