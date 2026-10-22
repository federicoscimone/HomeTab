/**
 * @fileoverview Le scadenze di pagamento: elenco con quote da accantonare, pagamenti
 * riconosciuti fra i movimenti, proposte dalle spese che si ripetono e promemoria.
 * @module lib/services/deadlines
 *
 * Calcoli in lib/utils/deadlines.js. I promemoria partono solo da sendDeadlineReminders(),
 * chiamata dal cron giornaliero (app/api/cron/promemoria).
 */

import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Deadline, { DEADLINE_KINDS, PERIODS } from '../models/Deadline.js';
import DismissedSuggestion from '../models/DismissedSuggestion.js';
import Movement from '../models/Movement.js';
import User from '../models/User.js';
import { sendTelegramMessage, telegramConfigured } from '../notify/telegram.js';
import { dayOf } from '../utils/goalMath.js';
import { fmtDate, fmtFull } from '../utils/format.js';
import { merchantTokens } from '../utils/merchantHistory.js';
import {
  addDays, daysBetween, detectPeriodic, findPayment, monthlyReserve, reminderStage, upcoming,
} from '../utils/deadlines.js';

/** Finestra della dashboard e dei totali «in arrivo». */
export const SOON_DAYS = 30;

const round2 = (v) => Math.round(v * 100) / 100;
const EXPENSES = { type: 'expense', excludeFromAnalysis: { $ne: true } };

/**
 * Valida i campi di una scadenza.
 *
 * @param {object} body
 * @param {boolean} [partial] - Per le modifiche: solo i campi presenti.
 * @returns {{ data?: object, error?: string }} error è una chiave del namespace errors.
 */
export function parseDeadline(body, partial = false) {
  if (!body || typeof body !== 'object') return { error: 'invalidData' };
  const data = {};
  const has = (k) => k in body;
  if (!partial || has('title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 100) return { error: 'invalidData' };
    data.title = body.title.trim();
  }
  if (!partial || has('nextDate')) {
    if (typeof body.nextDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.nextDate)) return { error: 'invalidData' };
    data.nextDate = body.nextDate;
  }
  if (has('kind')) {
    if (!DEADLINE_KINDS.includes(body.kind)) return { error: 'invalidData' };
    data.kind = body.kind;
  }
  if (has('amount')) {
    if (body.amount !== null && !(typeof body.amount === 'number' && body.amount >= 0 && body.amount < 1e7)) return { error: 'invalidData' };
    data.amount = body.amount;
  }
  if (has('everyMonths')) {
    if (body.everyMonths !== null && !PERIODS.includes(body.everyMonths)) return { error: 'invalidData' };
    data.everyMonths = body.everyMonths;
  }
  if (has('remindDays')) {
    if (!Number.isInteger(body.remindDays) || body.remindDays < 0 || body.remindDays > 60) return { error: 'invalidData' };
    data.remindDays = body.remindDays;
  }
  if (has('categoryId')) {
    if (body.categoryId !== null && !mongoose.isValidObjectId(body.categoryId)) return { error: 'invalidData' };
    data.categoryId = body.categoryId;
  }
  for (const [k, max] of [['match', 60], ['notes', 500]]) {
    if (!has(k)) continue;
    if (typeof body[k] !== 'string' || body[k].length > max) return { error: 'invalidData' };
    data[k] = body[k].trim();
  }
  if (has('active')) data.active = body.active === true;
  // Data o periodo cambiati: i promemoria della scadenza precedente non valgono più.
  if ('nextDate' in data || 'everyMonths' in data) data.notified = [];
  return { data };
}

/**
 * Tutte le scadenze, con giorni mancanti, quota mensile e l'eventuale pagamento già fatto.
 *
 * @param {{ now?: Date }} [options]
 */
export async function listDeadlines({ now = new Date() } = {}) {
  const today = dayOf(now);
  const [deadlines, categories] = await Promise.all([
    Deadline.find().sort({ active: -1, nextDate: 1 }).lean(),
    Category.find({ level: 1 }).select('name').lean(),
  ]);
  const names = new Map(categories.map((c) => [String(c._id), c.name]));
  const near = deadlines.filter((d) => d.active && daysBetween(today, d.nextDate) <= SOON_DAYS);
  const earliest = near.reduce((min, d) => (d.nextDate < min ? d.nextDate : min), today);
  const movements = near.length
    ? await Movement.find({ ...EXPENSES, date: { $gte: addDays(earliest, -20), $lte: today } })
      .select('date amount payee description').lean()
    : [];

  const rows = deadlines.map((d) => {
    const paid = near.includes(d) ? findPayment(d, movements, today) : null;
    return {
      ...d,
      id: String(d._id),
      categoryName: d.categoryId ? names.get(String(d.categoryId)) ?? null : null,
      daysLeft: daysBetween(today, d.nextDate),
      reserve: monthlyReserve(d),
      payment: paid && { date: paid.date, amount: paid.amount, text: paid.payee || paid.description },
    };
  });
  const soon = upcoming(rows, today, SOON_DAYS);
  return {
    today,
    deadlines: rows,
    totals: {
      monthlyReserve: round2(rows.reduce((s, d) => s + d.reserve, 0)),
      soonAmount: round2(soon.reduce((s, d) => s + (d.amount ?? 0), 0)),
      soonCount: soon.length,
      overdue: soon.filter((d) => d.daysLeft < 0 && !d.payment).length,
    },
  };
}

/**
 * Spese che si ripetono ogni 2-12 mesi e non sono ancora una scadenza.
 *
 * @param {{ now?: Date }} [options]
 */
export async function suggestDeadlines({ now = new Date() } = {}) {
  const today = dayOf(now);
  const since = addDays(today, -760);
  const [movements, existing, dismissed] = await Promise.all([
    Movement.find({ ...EXPENSES, date: { $gte: since, $lte: today } }).select('date amount payee description categoryId paymentMethod').lean(),
    Deadline.find().select('title match').lean(),
    DismissedSuggestion.find({ _id: /^deadline:/ }).select('_id').lean(),
  ]);
  const ignored = new Set(dismissed.map((d) => d._id.slice('deadline:'.length)));
  const known = existing.map((d) => merchantTokens(d.match || d.title));
  const covered = (match) => {
    const words = match.split(' ');
    return known.some((k) => k.length && k.every((w) => words.includes(w)));
  };
  return detectPeriodic(movements, today)
    .filter((s) => !covered(s.match) && !ignored.has(s.match))
    .map((s) => ({ ...s, categoryId: s.categoryId ? String(s.categoryId) : null }));
}

/** «Ignora» su una proposta: non torna più. */
export async function dismissSuggestion(match, userId) {
  await DismissedSuggestion.updateOne({ _id: `deadline:${match}` }, { $set: { dismissedBy: userId } }, { upsert: true });
}

/**
 * Manda su Telegram i promemoria di oggi a tutti gli utenti con la chat collegata.
 *
 * @param {{ now?: Date, text: (locale: string, key: string, vars: object) => Promise<string>|string }} options
 * @returns {Promise<{ sent: number, deadlines: number }>}
 */
export async function sendDeadlineReminders({ now = new Date(), text }) {
  if (!telegramConfigured()) return { sent: 0, deadlines: 0 };
  const today = dayOf(now);
  const [deadlines, users] = await Promise.all([
    Deadline.find({ active: true, remindDays: { $gt: 0 }, nextDate: { $lte: addDays(today, 60) } }).lean(),
    User.find({ telegramChatId: { $ne: null }, active: { $ne: false } }).select('telegramChatId locale').lean(),
  ]);
  let sent = 0;
  let due = 0;
  for (const d of deadlines) {
    const stage = reminderStage(d, today);
    if (!stage) continue;
    due += 1;
    const days = daysBetween(today, d.nextDate);
    for (const u of users) {
      const key = stage === 'before' ? 'reminderBefore' : days < 0 ? 'reminderOverdue' : 'reminderDue';
      try {
        const locale = u.locale ?? undefined;
        await sendTelegramMessage(u.telegramChatId, await text(u.locale, key, {
          title: d.title,
          amount: d.amount > 0 ? fmtFull(d.amount, locale) : '',
          date: fmtDate(d.nextDate, locale),
          days: Math.abs(days),
        }));
        sent += 1;
      } catch {
        // Una chat non raggiungibile (bot bloccato) non deve fermare gli altri promemoria.
      }
    }
    await Deadline.updateOne({ _id: d._id }, { $addToSet: { notified: stage } });
  }
  return { sent, deadlines: due };
}
