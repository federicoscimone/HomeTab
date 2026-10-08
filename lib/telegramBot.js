/**
 * @fileoverview Il bot Telegram: risposte ai messaggi e registrazione del webhook.
 * @module lib/telegramBot
 *
 * Due modi di ricevere i messaggi, stessa logica:
 * - webhook: Telegram chiama /api/telegram/webhook. Serve un indirizzo HTTPS pubblico (Vercel,
 *   o un server esposto su internet). Si attiva impostando TELEGRAM_WEBHOOK_SECRET.
 * - polling: workers/telegram.js chiede i messaggi con getUpdates. Funziona anche dietro NAT,
 *   per le istanze raggiungibili solo in LAN.
 * Un bot usa un solo modo alla volta (Telegram non accetta getUpdates con un webhook attivo) e
 * serve una sola istanza: i collegamenti delle chat stanno nel suo database.
 *
 * Solo import relativi: lo carica anche node fuori da Next. I testi li fornisce il chiamante.
 */

import crypto from 'crypto';
import User from './models/User.js';
import TelegramLink from './models/TelegramLink.js';
import { hashToken } from './utils/tokens.js';
import { sendTelegramMessage, telegramCall } from './notify/telegram.js';
import { DEFAULT_LOCALE } from './i18n/locale.js';

/**
 * @callback BotText
 * @param {string} locale
 * @param {string} key - Chiave del namespace telegramBot di messages/*.json.
 * @param {object} [vars]
 * @returns {string|Promise<string>}
 */

/** Lingua del messaggio quando l'utente non è ancora noto: quella del client Telegram, se c'è. */
const clientLocale = (message) => (message.from?.language_code?.startsWith('en') ? 'en' : DEFAULT_LOCALE);

/**
 * Risponde a un update del Bot API: "/start <token>" collega la chat all'utente che ha generato
 * il token dalla pagina Account; qualunque altro messaggio riceve una breve spiegazione.
 *
 * @param {object} update
 * @param {BotText} text
 */
export async function handleUpdate(update, text) {
  const message = update?.message;
  // Solo chat private: in un gruppo il chatId non identificherebbe una persona.
  if (!message || message.chat?.type !== 'private' || typeof message.text !== 'string') return;
  const chatId = String(message.chat.id);
  const [command, token] = message.text.trim().split(/\s+/, 2);

  if (command !== '/start' || !token) {
    const user = await User.findOne({ telegramChatId: chatId }).select('locale').lean();
    await sendTelegramMessage(chatId, await text(user?.locale ?? clientLocale(message), user ? 'alreadyLinked' : 'help'));
    return;
  }

  // Il token si consuma una volta sola, e solo se non è scaduto.
  const link = await TelegramLink.findOneAndDelete({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!link) {
    await sendTelegramMessage(chatId, await text(clientLocale(message), 'invalidLink'));
    return;
  }

  // Una chat appartiene a un solo utente. Se è già di un altro, il collegamento si rifiuta:
  // spostarla toglierebbe all'altro, senza avvisarlo, il canale dei suoi codici.
  const owner = await User.findOne({ telegramChatId: chatId, _id: { $ne: link.userId } }).select('_id').lean();
  if (owner) {
    await sendTelegramMessage(chatId, await text(clientLocale(message), 'chatTaken'));
    return;
  }

  const user = await User.findByIdAndUpdate(
    link.userId,
    { telegramChatId: chatId, telegramLinkedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!user) return;
  await sendTelegramMessage(chatId, await text(user.locale ?? clientLocale(message), 'linked', { name: user.name }));
}

/** @returns {boolean} true se il bot riceve i messaggi via webhook invece che con il polling. */
export const webhookMode = () => Boolean(process.env.TELEGRAM_WEBHOOK_SECRET);

/**
 * Il segreto che Telegram rimanda nell'header X-Telegram-Bot-Api-Secret-Token: da 1 a 256
 * caratteri fra lettere, cifre, "_" e "-" (regola del Bot API).
 *
 * @param {string|undefined} secret
 */
export const validWebhookSecret = (secret) => typeof secret === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(secret);

/**
 * Indirizzo del webhook: la base pubblica dell'app più la route. Il parametro v è un'impronta
 * del segreto: cambiando il segreto cambia l'indirizzo, e la registrazione automatica se ne
 * accorge (getWebhookInfo restituisce l'indirizzo, mai il segreto).
 *
 * @param {string|undefined} base - Es. NEXTAUTH_URL.
 * @param {string} secret
 * @returns {string|null} null se la base non è HTTPS: Telegram accetta solo webhook HTTPS.
 */
export function webhookUrl(base, secret) {
  if (!base?.startsWith('https://')) return null;
  const version = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8);
  return `${base.replace(/\/+$/, '')}/api/telegram/webhook?v=${version}`;
}

/**
 * Registra il webhook se quello attuale è diverso. La chiama l'app all'avvio (instrumentation.js).
 *
 * @returns {Promise<'set'|'unchanged'>}
 */
export async function ensureWebhook() {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!validWebhookSecret(secret)) throw new Error('TELEGRAM_WEBHOOK_SECRET: solo lettere, cifre, _ e -, fino a 256 caratteri');
  const url = webhookUrl(process.env.APP_URL || process.env.NEXTAUTH_URL, secret);
  if (!url) throw new Error('Il webhook di Telegram richiede un indirizzo HTTPS (APP_URL o NEXTAUTH_URL)');

  const info = await telegramCall('getWebhookInfo', {});
  if (info.url === url) return 'unchanged';
  await telegramCall('setWebhook', { url, secret_token: secret, allowed_updates: ['message'] });
  return 'set';
}
