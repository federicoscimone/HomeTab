/**
 * @fileoverview Emissione e verifica dei codici monouso su Mongo.
 * @module lib/services/otp
 *
 * Le regole stanno in lib/auth/otp.js; qui le operazioni che devono essere atomiche. Un codice
 * giusto marca la sfida come usata con un aggiornamento condizionato (usedAt ancora null): due
 * richieste parallele con lo stesso codice non possono passare entrambe.
 */

import OtpChallenge from '../models/OtpChallenge.js';
import User from '../models/User.js';
import { generateToken, hashToken, tokenExpiry } from '../utils/tokens.js';
import {
  OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES, challengeStatus, codeMatches, generateCode, normalizeCode,
} from '../auth/otp.js';

/**
 * Crea una sfida nuova per utente e scopo, annullando quelle aperte: vale solo l'ultimo codice.
 *
 * @param {{ userId: string, purpose: 'login'|'reset'|'enable', channel: 'telegram'|'email', withTicket?: boolean }} params
 * @returns {Promise<{ code: string, ticket: string|null }>} Codice e ticket in chiaro, da consegnare
 *   rispettivamente sul canale e al browser; nel database restano solo gli hash.
 */
export async function issueChallenge({ userId, purpose, channel, withTicket = false }) {
  await OtpChallenge.deleteMany({ userId, purpose, usedAt: null });
  const code = generateCode();
  const ticket = withTicket ? generateToken() : null;
  await OtpChallenge.create({
    userId,
    purpose,
    channel,
    codeHash: hashToken(code),
    ticketHash: ticket ? hashToken(ticket) : null,
    expiresAt: tokenExpiry(OTP_TTL_MINUTES),
  });
  return { code, ticket };
}

/**
 * Verifica un codice contro una sfida trovata con `query`.
 *
 * @param {object} query - Filtro Mongo che individua la sfida (per ticket, o per utente e scopo).
 * @param {unknown} rawCode
 * @returns {Promise<{ ok: true, challenge: object } | { ok: false, reason: 'invalid'|'expired'|'exhausted' }>}
 *   `reason` serve ai log: all'utente si mostra sempre un messaggio generico.
 */
async function verify(query, rawCode) {
  const code = normalizeCode(rawCode);
  const challenge = await OtpChallenge.findOne(query).sort({ createdAt: -1 });
  if (!challenge || !code) return { ok: false, reason: 'invalid' };

  const status = challengeStatus(challenge);
  if (status === 'used') return { ok: false, reason: 'invalid' };
  if (status !== 'open') return { ok: false, reason: status };

  if (!codeMatches(code, challenge.codeHash)) {
    await OtpChallenge.updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
    return { ok: false, reason: 'invalid' };
  }

  const claimed = await OtpChallenge.findOneAndUpdate(
    { _id: challenge._id, usedAt: null, attempts: { $lt: OTP_MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { returnDocument: 'after' },
  );
  return claimed ? { ok: true, challenge: claimed } : { ok: false, reason: 'invalid' };
}

/**
 * Secondo passo del login: ticket rilasciato dopo la password + codice ricevuto.
 *
 * @returns {Promise<object|null>} L'utente (documento Mongoose), o null.
 */
export async function verifyLoginCode(ticket, code) {
  if (typeof ticket !== 'string' || !ticket) return null;
  const result = await verify({ ticketHash: hashToken(ticket), purpose: 'login' }, code);
  if (!result.ok) return null;
  const user = await User.findById(result.challenge.userId);
  return user && user.active !== false ? user : null;
}

/**
 * Codice per reset o attivazione della 2FA, cercato per utente e scopo.
 *
 * @param {{ userId: string, purpose: 'reset'|'enable', code: unknown }} params
 * @returns {Promise<{ ok: boolean, channel?: string }>}
 */
export async function verifyUserCode({ userId, purpose, code }) {
  const result = await verify({ userId, purpose }, code);
  return result.ok ? { ok: true, channel: result.challenge.channel } : { ok: false };
}
