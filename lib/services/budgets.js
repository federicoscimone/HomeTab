/**
 * @fileoverview I budget mensili per categoria: lo stato del mese, i valori suggeriti e gli
 * avvisi su Telegram. Calcoli in lib/utils/budgets.js.
 * @module lib/services/budgets
 *
 * Contano tutte le uscite della categoria, con qualunque metodo di pagamento (i buoni pasto sono
 * spesa alimentare come le altre), senza i movimenti esclusi dalle analisi.
 */

import Budget from '../models/Budget.js';
import Category from '../models/Category.js';
import Movement from '../models/Movement.js';
import User from '../models/User.js';
import { sendTelegramMessage, telegramConfigured } from '../notify/telegram.js';
import { addMonths, dayOf, monthOf } from '../utils/goalMath.js';
import { alertToSend, budgetStatus, suggestedBudget } from '../utils/budgets.js';
import { fmtFull } from '../utils/format.js';

const SCOPE = { type: 'expense', excludeFromAnalysis: { $ne: true } };
const lastDay = (month) => `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;

async function spentByCategory(from, to) {
  const rows = await Movement.aggregate([
    { $match: { ...SCOPE, date: { $gte: from, $lte: to }, categoryId: { $ne: null } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.total]));
}

/**
 * Lo stato dei budget nel mese in corso, più le categorie con la media degli ultimi 3 mesi
 * completi e il budget suggerito.
 *
 * @param {{ now?: Date }} [options]
 */
export async function budgetOverview({ now = new Date() } = {}) {
  const today = dayOf(now);
  const month = monthOf(now);
  const from3 = `${addMonths(month, -3)}-01`;
  const to3 = lastDay(addMonths(month, -1));
  const [budgets, categories, spent, past] = await Promise.all([
    Budget.find().lean(),
    Category.find({ level: 1 }).sort({ order: 1, name: 1 }).select('name color').lean(),
    spentByCategory(`${month}-01`, today),
    spentByCategory(from3, to3),
  ]);
  const names = new Map(categories.map((c) => [String(c._id), c]));
  const status = budgetStatus(budgets.map((b) => ({ categoryId: String(b.categoryId), amount: b.amount })), spent, today);
  return {
    month,
    budgets: status.map((s) => ({ ...s, name: names.get(s.categoryId)?.name ?? '?', color: names.get(s.categoryId)?.color ?? null }))
      .sort((a, b) => b.pct - a.pct),
    categories: categories.map((c) => {
      const average = Math.round(((past[String(c._id)] ?? 0) / 3) * 100) / 100;
      return { id: String(c._id), name: c.name, average, suggested: suggestedBudget(average) };
    }),
  };
}

/**
 * Una riga per la risposta del bot dopo una spesa: «Spesa: 640 € di 700 € (91%)». Null se la
 * categoria non ha un budget.
 */
export async function budgetLineFor(categoryId, { now = new Date(), locale, say } = {}) {
  if (!categoryId) return null;
  const budget = await Budget.findOne({ categoryId }).lean();
  if (!budget) return null;
  const month = monthOf(now);
  const spent = await spentByCategory(`${month}-01`, dayOf(now));
  const [s] = budgetStatus([{ categoryId: String(categoryId), amount: budget.amount }], spent, dayOf(now));
  const category = await Category.findById(categoryId).select('name').lean();
  return say(s.level === 'over' ? 'budgetOver' : 'budgetLine', {
    category: category?.name ?? '', spent: fmtFull(s.spent, locale), amount: fmtFull(s.amount, locale), pct: s.pct,
  });
}

/**
 * Gli avvisi del giorno: per ogni budget che ha superato l'80% o il 100% nel mese, una volta per
 * soglia, a chi ha collegato Telegram. Lo chiama il cron giornaliero.
 *
 * @param {{ now?: Date, text: (locale: string, key: string, vars: object) => Promise<string>|string }} options
 */
export async function sendBudgetAlerts({ now = new Date(), text }) {
  if (!telegramConfigured()) return { sent: 0, budgets: 0 };
  const month = monthOf(now);
  const overview = await budgetOverview({ now });
  const users = await User.find({ telegramChatId: { $ne: null }, active: { $ne: false } }).select('telegramChatId locale').lean();
  const docs = await Budget.find().lean();
  let sent = 0;
  let alerted = 0;
  for (const b of overview.budgets) {
    const doc = docs.find((d) => String(d.categoryId) === b.categoryId);
    const level = alertToSend(b.pct, doc?.notified, month);
    if (!level) continue;
    alerted += 1;
    for (const u of users) {
      try {
        const locale = u.locale ?? undefined;
        await sendTelegramMessage(u.telegramChatId, await text(u.locale, level >= 100 ? 'alertOver' : 'alertNear', {
          category: b.name, spent: fmtFull(b.spent, locale), amount: fmtFull(b.amount, locale), pct: b.pct,
        }));
        sent += 1;
      } catch {
        // Una chat non raggiungibile non ferma gli altri avvisi.
      }
    }
    const levels = doc?.notified?.month === month ? doc.notified.levels : [];
    // Tutte le soglie fino a quella avvisata: superato il 100%, l'80% non va più mandato.
    const reached = [...new Set([...levels, ...[80, 100].filter((l) => l <= level)])];
    await Budget.updateOne({ _id: doc._id }, { $set: { notified: { month, levels: reached } } });
  }
  return { sent, budgets: alerted };
}
