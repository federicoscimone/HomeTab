/**
 * @fileoverview I budget mensili per categoria: a che punto siete, dove arriverete a fine mese a
 * questo ritmo, e quando avvisare. Solo calcoli, provati nei test.
 * @module lib/utils/budgets
 */

/** Soglie degli avvisi, in percentuale del budget. */
export const ALERT_LEVELS = [80, 100];

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * @param {{ categoryId: string, amount: number }[]} budgets
 * @param {Record<string, number>} spent - Speso nel mese per categoria.
 * @param {string} today - YYYY-MM-DD.
 */
export function budgetStatus(budgets, spent, today) {
  const [y, m, d] = today.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return budgets.map((b) => {
    const value = round2(spent[b.categoryId] ?? 0);
    const pct = b.amount > 0 ? Math.round((value / b.amount) * 100) : 0;
    // A questo ritmo: lo speso finora diviso per i giorni passati, per tutti i giorni del mese.
    // Nei primi giorni la stima oscilla molto: si mostra solo dal quinto.
    const projected = d >= 5 ? round2((value / d) * days) : null;
    return {
      categoryId: b.categoryId,
      amount: b.amount,
      spent: value,
      remaining: round2(b.amount - value),
      pct,
      projected,
      level: pct >= 100 ? 'over' : pct >= ALERT_LEVELS[0] ? 'warning' : 'ok',
    };
  });
}

/**
 * La soglia da avvisare adesso, se una: la più alta superata e non ancora avvisata in questo mese.
 *
 * @param {number} pct
 * @param {{ month?: string, levels?: number[] }} notified - Avvisi già mandati.
 * @param {string} month - YYYY-MM.
 * @returns {number|null}
 */
export function alertToSend(pct, notified, month) {
  const sent = notified?.month === month ? notified.levels ?? [] : [];
  const reached = ALERT_LEVELS.filter((l) => pct >= l);
  const top = reached.at(-1);
  return top != null && !sent.includes(top) ? top : null;
}

/** Il budget suggerito: la media degli ultimi mesi, arrotondata alla decina sopra. */
export const suggestedBudget = (average) => (average > 0 ? Math.ceil(average / 10) * 10 : null);
