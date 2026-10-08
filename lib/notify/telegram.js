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
 */
export const sendTelegramMessage = (chatId, text) =>
  telegramCall('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
