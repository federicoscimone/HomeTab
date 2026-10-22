/**
 * @fileoverview Il bot Telegram: risposte ai messaggi e registrazione del webhook.
 * @module lib/telegramBot
 *
 * Due modi di ricevere i messaggi, stessa logica nell'app:
 * - webhook: Telegram chiama /api/telegram/webhook. Serve un indirizzo HTTPS pubblico (Vercel,
 *   o un server esposto su internet). Si attiva impostando TELEGRAM_WEBHOOK_SECRET.
 * - polling: workers/telegram.js chiede i messaggi con getUpdates e li consegna alla stessa
 *   rotta dell'app (relayToken). Funziona anche dietro NAT, per le istanze solo in LAN.
 * Un bot usa un solo modo alla volta (Telegram non accetta getUpdates con un webhook attivo) e
 * serve una sola istanza: i collegamenti delle chat stanno nel suo database.
 *
 * Solo import relativi in testa al file: lo carica anche node fuori da Next (il processo di
 * polling e i test). La registrazione dei movimenti si carica con un import dinamico, solo
 * dentro l'app. I testi li fornisce il chiamante.
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

/** Il registratore dei movimenti si carica solo quando serve: usa l'IA e moduli dell'app. */
const entry = () => import('./services/telegramEntry.js');

/** L'utente collegato a una chat, se esiste ed è attivo. */
const linkedUser = (chatId) =>
  User.findOne({ telegramChatId: chatId, active: { $ne: false } }).select('name email role locale').lean();

/**
 * Risponde a un update del Bot API:
 * - "/start <token>" collega la chat all'utente che ha generato il token dalla pagina Account;
 * - da una chat collegata, una riga con un importo («12,50 pizza») registra un movimento e la
 *   foto di uno scontrino ne prepara uno da confermare (lib/services/telegramEntry.js);
 * - i pulsanti sotto quei messaggi arrivano come callback_query;
 * - qualunque altro messaggio riceve una breve spiegazione.
 *
 * @param {object} update
 * @param {BotText} text
 */
export async function handleUpdate(update, text) {
  if (update?.callback_query) {
    const callback = update.callback_query;
    if (callback.message?.chat?.type !== 'private') return;
    const user = await linkedUser(String(callback.message.chat.id));
    if (!user) return;
    await (await entry()).handleCallback({ user, callback, say: (key, vars) => text(user.locale, key, vars) });
    return;
  }

  const message = update?.message;
  // Solo chat private: in un gruppo il chatId non identificherebbe una persona.
  if (!message || message.chat?.type !== 'private') return;
  const chatId = String(message.chat.id);

  if (Array.isArray(message.photo) && message.photo.length) {
    const user = await linkedUser(chatId);
    if (!user) {
      await sendTelegramMessage(chatId, await text(clientLocale(message), 'help'));
      return;
    }
    await (await entry()).handleReceiptPhoto({ user, chatId, photo: message.photo, say: (key, vars) => text(user.locale, key, vars) });
    return;
  }
  if (typeof message.text !== 'string') return;
  const [command, token] = message.text.trim().split(/\s+/, 2);

  if (command !== '/start' || !token) {
    const user = await linkedUser(chatId);
    const say = (key, vars) => text(user?.locale ?? clientLocale(message), key, vars);
    if (user && !message.text.startsWith('/') && await (await entry()).handleQuickText({ user, chatId, text: message.text, say })) return;
    await sendTelegramMessage(chatId, await say(user ? 'alreadyLinked' : 'help'));
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

/**
 * Il token con cui il processo di polling (workers/telegram.js) consegna gli update all'app:
 * un HMAC del segreto del server, che entrambi conoscono già. Nessuna variabile in più, e chi non
 * conosce il segreto non può fingersi Telegram.
 *
 * @returns {string|null}
 */
export function relayToken() {
  const secret = process.env.NEXTAUTH_SECRET;
  return secret ? crypto.createHmac('sha256', secret).update('telegram-relay').digest('hex') : null;
}

/** I tipi di update che il bot riceve: messaggi e pulsanti premuti. */
export const ALLOWED_UPDATES = ['message', 'callback_query'];

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
  // Anche i tipi di update contano: prima della registrazione dei movimenti bastava 'message',
  // ora servono i pulsanti (callback_query), e un webhook vecchio non li riceverebbe.
  const allowed = info.allowed_updates ?? [];
  if (info.url === url && ALLOWED_UPDATES.every((u) => allowed.includes(u))) return 'unchanged';
  await telegramCall('setWebhook', { url, secret_token: secret, allowed_updates: ALLOWED_UPDATES });
  return 'set';
}
