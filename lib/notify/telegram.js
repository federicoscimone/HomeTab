/**
 * @fileoverview Chiamate al Bot API di Telegram, condivise dall'app e dal processo del bot.
 * @module lib/notify/telegram
 *
 * Solo import relativi e nessuna dipendenza da Next: lo usa anche workers/telegram.js, che gira
 * con node fuori dall'app. L'URL contiene il token del bot, quindi non va mai scritto nei log.
 */

const apiBase = () => process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';

/**
 * La configurazione in uso, condivisa da tutto il processo. La imposta
 * lib/services/telegramSettings.js con quella salvata da Impostazioni → Telegram; finché non c'è,
 * valgono le variabili d'ambiente. Sta su globalThis perché Next compila instrumentation e rotte
 * in pacchetti separati: una variabile di modulo non sarebbe la stessa per tutti.
 */
const RUNTIME = Symbol.for('hometab.telegram.runtime');

/**
 * @typedef {Object} TelegramRuntime
 * @property {string|null} token
 * @property {string|null} username - Senza "@".
 * @property {'polling'|'webhook'} mode
 * @property {string|null} webhookSecret
 * @property {'db'|'env'|null} source
 */

/** @param {TelegramRuntime|null} config - null torna alle variabili d'ambiente. */
export function setTelegramRuntime(config) {
  globalThis[RUNTIME] = config ? { ...config } : null;
}

/** @returns {TelegramRuntime} */
export function telegramRuntime(env = process.env) {
  const saved = globalThis[RUNTIME];
  if (saved) return saved;
  const token = env.TELEGRAM_BOT_TOKEN || null;
  const username = env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || null;
  return {
    token,
    username,
    mode: env.TELEGRAM_WEBHOOK_SECRET ? 'webhook' : 'polling',
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || null,
    source: token && username ? 'env' : null,
  };
}

/** @returns {boolean} true se il bot è configurato (token e nome utente). */
export const telegramConfigured = () => {
  const { token, username } = telegramRuntime();
  return Boolean(token && username);
};

/** @returns {string|null} Nome utente del bot, senza "@". */
export const botUsername = () => telegramRuntime().username;

/**
 * @param {string} method - Metodo del Bot API, es. "sendMessage".
 * @param {object} params
 * @param {{ signal?: AbortSignal, token?: string }} [options] - token: per provare un token
 *   prima di salvarlo; di norma quello della configurazione in uso.
 * @returns {Promise<any>} Il campo `result` della risposta.
 */
export async function telegramCall(method, params, { signal, token } = {}) {
  const res = await fetch(`${apiBase()}/bot${token ?? telegramRuntime().token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || `HTTP ${res.status}`}`);
  return data.result;
}

/**
 * @param {string|number} chatId
 * @param {string} text - Testo semplice: niente parse_mode, così un nome con * o _ non rompe nulla.
 * @param {{ buttons?: { text: string, data: string }[] }} [options] - Pulsanti sotto il messaggio,
 *   su una riga; `data` torna al bot come callback_query (massimo 64 byte).
 */
export const sendTelegramMessage = (chatId, text, { buttons } = {}) =>
  telegramCall('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(buttons?.length ? { reply_markup: { inline_keyboard: [buttons.map((b) => ({ text: b.text, callback_data: b.data }))] } } : {}),
  });

/** Massima dimensione di una foto scaricata: oltre, non è uno scontrino da leggere. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Scarica un file mandato al bot (getFile, poi il percorso di download).
 *
 * @param {string} fileId
 * @returns {Promise<Buffer>}
 */
export async function telegramFile(fileId) {
  const file = await telegramCall('getFile', { file_id: fileId });
  if (!file?.file_path || file.file_size > MAX_FILE_BYTES) throw new Error('Telegram getFile: file assente o troppo grande');
  const res = await fetch(`${apiBase()}/file/bot${telegramRuntime().token}/${file.file_path}`);
  if (!res.ok) throw new Error(`Telegram file: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_FILE_BYTES) throw new Error('Telegram file: troppo grande');
  return buffer;
}
