/**
 * @fileoverview Regole dei codici monouso, senza database: si provano con node --test.
 * @module lib/auth/otp
 *
 * Un codice vale 5 minuti, si può sbagliare al massimo 5 volte, si usa una volta sola ed è legato
 * a uno scopo (login, reset, attivazione): un codice di login non reimposta una password.
 */

import crypto from 'crypto';
import { hashToken } from '../utils/tokens.js';

export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 6;

/** @returns {string} Sei cifre casuali, zeri iniziali compresi ("004213"). */
export function generateCode() {
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/**
 * @param {unknown} input - Quanto scritto dall'utente: spazi e trattini sono tollerati.
 * @returns {string|null} Le sei cifre, o null se il formato non è quello di un codice.
 */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s-]/g, '');
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(digits) ? digits : null;
}

/**
 * Confronto in tempo costante fra il codice ricevuto e l'hash salvato.
 *
 * @param {string} code
 * @param {string} codeHash
 */
export function codeMatches(code, codeHash) {
  const received = Buffer.from(hashToken(code), 'hex');
  const expected = Buffer.from(String(codeHash), 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

/**
 * @param {{ usedAt: Date|null, expiresAt: Date, attempts: number }} challenge
 * @param {Date} [now]
 * @returns {'open'|'used'|'expired'|'exhausted'}
 */
export function challengeStatus(challenge, now = new Date()) {
  if (challenge.usedAt) return 'used';
  if (challenge.expiresAt <= now) return 'expired';
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return 'exhausted';
  return 'open';
}

/**
 * Se un utente può entrare con la sola password. È il controllo che impedisce di saltare il
 * codice chiamando direttamente il login di NextAuth: con la 2FA attiva la password da sola non
 * basta mai, serve il ticket rilasciato insieme al codice.
 *
 * @param {{ twoFactorEnabled?: boolean }} user
 * @param {boolean} demoMode - Nella demo la 2FA è spenta: le credenziali sono pubbliche.
 */
export function passwordAloneAllowed(user, demoMode) {
  return demoMode || !user.twoFactorEnabled;
}
