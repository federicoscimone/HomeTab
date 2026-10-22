/**
 * @fileoverview Registrare movimenti dal bot Telegram: una riga di testo o la foto di uno
 * scontrino.
 * @module lib/services/telegramEntry
 *
 * - Testo («12,50 pizza»): lettura senza IA (lib/utils/quickEntry.js), categoria dalla catena
 *   locale dell'import, movimento registrato subito con un pulsante «Annulla».
 * - Foto: il modello legge esercente, data, totale e pagamento (lib/ai/tasks/receipt.js); il
 *   movimento resta una bozza finché non si preme «Registra». La foto non si salva.
 *
 * Solo per gli utenti con il permesso di creare movimenti. Gira dentro l'app (webhook, o relay
 * dal processo di polling), quindi può usare l'IA e il registro delle operazioni.
 */

import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Movement from '../models/Movement.js';
import TelegramDraft from '../models/TelegramDraft.js';
import { can } from '../auth/permissions.js';
import { sendTelegramMessage, telegramCall, telegramFile } from '../notify/telegram.js';
import { aiAvailability, AiError, runStructured } from '../ai/index.js';
import { loadAiSettings } from '../ai/settings.js';
import { readReceipt, SCHEMA as RECEIPT_SCHEMA, SYSTEM as RECEIPT_SYSTEM } from '../ai/tasks/receipt.js';
import { localSuggester } from './localCategorize.js';
import { suggestCategories } from '../ai/tasks/categorize.js';
import { DEFAULT_METHOD, parseQuickEntry } from '../utils/quickEntry.js';
import { getPaymentGroup } from '../utils/payments.js';
import { dayOf } from '../utils/goalMath.js';
import { fmtDate, fmtFull } from '../utils/format.js';
import { writeAuditRecord } from '../utils/audit.js';
import logger from '../logger.js';
import { budgetLineFor } from './budgets.js';

/** «Annulla» funziona per un giorno: dopo, il movimento si corregge dall'app. */
const UNDO_HOURS = 24;

/** @typedef {(key: string, vars?: object) => string|Promise<string>} Say */

/**
 * Il movimento da salvare, con la categoria della stessa catena dell'import: parole chiave e
 * storico in locale, poi (se attiva) l'IA, che riceve solo il testo mascherato del movimento.
 */
async function toMovement({ amount, type, date, paymentMethod, description, payee = '' }, userId) {
  const suggest = await localSuggester();
  const row = { description, payee: payee || description, place: '', type };
  let hit = suggest(row);
  if (!hit && aiAvailability('importCategorize', await loadAiSettings()).available) {
    try {
      const { suggestions } = await suggestCategories([{ id: 1, ...row, amount }], { userId });
      const s = suggestions.find((x) => x.categoryId && !x.uncertain);
      if (s) hit = { source: 'ai', categoryId: s.categoryId, subCategory1Id: s.subCategory1Id };
    } catch (err) {
      logger.warn('Categoria IA per Telegram non riuscita', { error: err?.message });
    }
  }
  return {
    amount, type, date, paymentMethod,
    paymentGroup: getPaymentGroup(paymentMethod),
    description: description.slice(0, 500),
    payee: (payee || '').slice(0, 200),
    categoryId: hit?.categoryId ?? null,
    subCategory1Id: hit?.subCategory1Id ?? null,
    source: 'telegram',
    // Solo per il messaggio di risposta: non è un campo del movimento e Mongoose lo scarta.
    categoryFromAi: hit?.source === 'ai',
  };
}

/** «Spesa · Cibo Pronto → Pizzeria», o «senza categoria». */
async function describe(m, locale, say) {
  const ids = [m.categoryId, m.subCategory1Id].filter(Boolean);
  const cats = ids.length ? await Category.find({ _id: { $in: ids } }).select('name').lean() : [];
  const name = (id) => cats.find((c) => String(c._id) === String(id))?.name;
  let category = m.categoryId ? [name(m.categoryId), name(m.subCategory1Id)].filter(Boolean).join(' → ') : await say('noCategory');
  if (m.categoryFromAi) category = await say('categoryFromAi', { category });
  return say('summary', {
    amount: fmtFull(m.amount, locale),
    kind: await say(m.type === 'income' ? 'income' : 'expense'),
    text: m.payee || m.description || '—',
    category,
    date: fmtDate(m.date, locale),
  });
}

async function save(user, { categoryFromAi, ...data }, how) {
  const movement = await Movement.create(data);
  await writeAuditRecord({
    userId: user._id, userEmail: user.email, req: null,
    action: 'CREATE', resource: 'movement', resourceId: movement._id,
    description: `Movimento da Telegram (${how}): ${data.amount.toFixed(2)} € ${data.payee || data.description}`,
  });
  return movement;
}

/**
 * Una riga di testo. Restituisce false se non contiene un importo: allora il bot risponde con
 * l'aiuto.
 *
 * @param {{ user: object, chatId: string, text: string, say: Say }} args
 */
export async function handleQuickText({ user, chatId, text, say }) {
  if (!can(user.role, 'movements:create')) return false;
  const parsed = parseQuickEntry(text, dayOf(new Date()));
  if (!parsed) return false;
  const data = await toMovement(parsed, user._id);
  const movement = await save(user, data, 'testo');
  const budget = data.type === 'expense' ? await budgetLineFor(data.categoryId, { locale: user.locale, say }) : null;
  await sendTelegramMessage(chatId, [await say('saved'), await describe(data, user.locale, say), budget].filter(Boolean).join('\n'), {
    buttons: [{ text: await say('undo'), data: `undo:${movement._id}` }],
  });
  return true;
}

/**
 * La foto di uno scontrino: lettura con il modello, poi una bozza con «Registra» e «Annulla».
 *
 * @param {{ user: object, chatId: string, photo: { file_id: string, width: number, height: number }[], say: Say }} args
 */
export async function handleReceiptPhoto({ user, chatId, photo, say }) {
  if (!can(user.role, 'movements:create')) {
    await sendTelegramMessage(chatId, await say('notAllowed'));
    return;
  }
  const availability = aiAvailability('receiptScan', await loadAiSettings());
  if (!availability.available) {
    await sendTelegramMessage(chatId, await say('photoNoAi'));
    return;
  }
  // Telegram manda più formati della stessa foto: il più grande basta e avanza per uno scontrino.
  const largest = [...photo].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  await telegramCall('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});

  let receipt = null;
  try {
    const image = (await telegramFile(largest.file_id)).toString('base64');
    const res = await runStructured({
      task: 'receiptScan', system: RECEIPT_SYSTEM, prompt: 'Read this receipt.', schema: RECEIPT_SCHEMA,
      maxTokens: 2_000, userId: user._id, images: [{ mediaType: 'image/jpeg', data: image }],
    });
    receipt = readReceipt(res.data, dayOf(new Date()));
  } catch (err) {
    logger.warn('Scontrino da Telegram non letto', { error: err?.message, code: err instanceof AiError ? err.code : null });
    await sendTelegramMessage(chatId, await say(err instanceof AiError && err.code === 'budget' ? 'photoBudget' : 'photoFailed'));
    return;
  }
  if (!receipt) {
    await sendTelegramMessage(chatId, await say('notAReceipt'));
    return;
  }

  const data = await toMovement({
    amount: receipt.amount, type: 'expense', date: receipt.date,
    paymentMethod: receipt.paymentMethod ?? DEFAULT_METHOD,
    description: receipt.merchant, payee: receipt.merchant,
  }, user._id);
  const draft = await TelegramDraft.create({ userId: user._id, chatId, movement: data });
  await sendTelegramMessage(chatId, `${await say('receiptRead')}\n${await describe(data, user.locale, say)}`, {
    buttons: [
      { text: await say('confirm'), data: `ok:${draft._id}` },
      { text: await say('discard'), data: `no:${draft._id}` },
    ],
  });
}

/**
 * Un pulsante premuto: registra la bozza, la scarta, o annulla un movimento appena registrato.
 *
 * @param {{ user: object, callback: object, say: Say }} args
 */
export async function handleCallback({ user, callback, say }) {
  const chatId = String(callback.message?.chat?.id ?? '');
  const [action, id] = String(callback.data ?? '').split(':');
  const done = async (key) => {
    await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text: await say(key) }).catch(() => {});
    // Il messaggio perde i pulsanti: un secondo tocco non registra due volte.
    if (callback.message) {
      await telegramCall('editMessageReplyMarkup', {
        chat_id: chatId, message_id: callback.message.message_id, reply_markup: { inline_keyboard: [] },
      }).catch(() => {});
    }
  };
  if (!mongoose.isValidObjectId(id) || !can(user.role, 'movements:create')) return done('expired');

  if (action === 'undo') {
    const since = new Date(Date.now() - UNDO_HOURS * 3_600_000);
    const removed = await Movement.findOneAndDelete({ _id: id, source: 'telegram', createdAt: { $gte: since } });
    if (removed) {
      await writeAuditRecord({
        userId: user._id, userEmail: user.email, req: null, action: 'DELETE', resource: 'movement', resourceId: id,
        description: `Movimento da Telegram annullato: ${removed.amount.toFixed(2)} € ${removed.payee || removed.description}`,
      });
    }
    return done(removed ? 'undone' : 'expired');
  }
  // La bozza si consuma in modo atomico: due tocchi ravvicinati non la registrano due volte.
  const draft = await TelegramDraft.findOneAndDelete({ _id: id, userId: user._id });
  if (!draft) return done('expired');
  if (action === 'ok') {
    await save(user, draft.movement, 'scontrino');
    const budget = await budgetLineFor(draft.movement.categoryId, { locale: user.locale, say });
    if (budget) await sendTelegramMessage(chatId, budget).catch(() => {});
    return done('savedShort');
  }
  return done('discarded');
}
