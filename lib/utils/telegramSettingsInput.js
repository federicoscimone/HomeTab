/**
 * @fileoverview Corpo di PUT /api/impostazioni/telegram, validato.
 * @module lib/utils/telegramSettingsInput
 */

/** Il formato dei token di @BotFather: id numerico, due punti, 35 caratteri base64url. */
const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,50}$/;
const MODES = new Set(['polling', 'webhook']);

/**
 * @param {unknown} body
 * @returns {{ data: { token: string|null, mode: 'polling'|'webhook' } } | { error: string }}
 *   error è una chiave del namespace "errors".
 *
 * @example
 * telegramSettingsInput({ mode: 'polling' }).data // { token: null, mode: 'polling' }
 */
export function telegramSettingsInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalidTelegramSettings' };
  const mode = body.mode ?? 'polling';
  if (!MODES.has(mode)) return { error: 'invalidTelegramSettings' };
  if (body.token == null || body.token === '') return { data: { token: null, mode } };
  if (typeof body.token !== 'string') return { error: 'telegramTokenInvalid' };
  const token = body.token.trim();
  if (!TOKEN_RE.test(token)) return { error: 'telegramTokenInvalid' };
  return { data: { token, mode } };
}
