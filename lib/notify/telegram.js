/**
 * @fileoverview Chiamate al Bot API di Telegram, condivise dall'app e dal processo del bot.
 * @module lib/notify/telegram
 *
 * Solo import relativi e nessuna dipendenza da Next: lo usa anche workers/telegram.js, che gira
 * con node fuori dall'app. L'URL contiene il token del bot, quindi non va mai scritto nei log.
 */

const apiBase = () => process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';

/** @returns {boolean} true se il bot è configurato (token e nome utente). */
export const telegramConfigured = () =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME);

/** @returns {string|null} Nome utente del bot, senza "@". */
export const botUsername = () => process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || null;

/**
 * @param {string} method - Metodo del Bot API, es. "sendMessage".
 * @param {object} params
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<any>} Il campo `result` della risposta.
 */
export async function telegramCall(method, params, { signal } = {}) {
  const res = await fetch(`${apiBase()}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
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
  const res = await fetch(`${apiBase()}/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!res.ok) throw new Error(`Telegram file: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_FILE_BYTES) throw new Error('Telegram file: troppo grande');
  return buffer;
}
