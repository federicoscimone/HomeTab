/**
 * @fileoverview Invio dei codici monouso sul canale scelto: Telegram o email.
 * @module lib/notify
 *
 * I testi partono nella lingua salvata sull'utente, o in quella della richiesta.
 */

import { serverTranslator } from '@/lib/i18n/server';
import { sendCodeEmail } from '@/lib/email';
import { OTP_TTL_MINUTES } from '@/lib/auth/otp';
import { botUsername, sendTelegramMessage, telegramConfigured } from './telegram.js';

export { botUsername, telegramConfigured };

/** @returns {boolean} true se l'SMTP è configurato e le email possono partire. */
export const emailConfigured = () => Boolean(process.env.SMTP_HOST);

/**
 * Canali su cui un utente può ricevere codici adesso.
 *
 * @param {{ telegramChatId?: string|null }} user
 * @returns {('telegram'|'email')[]}
 */
export function availableChannels(user) {
  const channels = [];
  if (telegramConfigured() && user.telegramChatId) channels.push('telegram');
  if (emailConfigured()) channels.push('email');
  return channels;
}

/**
 * @param {{ user: { email: string, name: string, locale?: string|null, telegramChatId?: string|null },
 *           channel: 'telegram'|'email', code: string, purpose: 'login'|'reset'|'enable' }} params
 */
export async function sendCode({ user, channel, code, purpose }) {
  if (channel === 'telegram') {
    const t = await serverTranslator('otp', user.locale);
    return sendTelegramMessage(user.telegramChatId, t(`telegram.${purpose}`, { code, minutes: OTP_TTL_MINUTES }));
  }
  return sendCodeEmail({ to: user.email, name: user.name, code, purpose, minutes: OTP_TTL_MINUTES, locale: user.locale });
}
