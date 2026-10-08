/**
 * @fileoverview Limite di tentativi per IP, contato su Mongo (vedi lib/models/RateLimit.js).
 * @module lib/rateLimit
 *
 * Si limita chi prova, non l'account: un blocco dell'account permetterebbe a chiunque di chiudere
 * fuori un utente sbagliando apposta, e sulla demo, dove le credenziali sono pubbliche, tutti.
 */

import RateLimit from './models/RateLimit.js';

/** Limiti per azione: tentativi ammessi in una finestra. */
export const LIMITS = {
  // Un login con password conta due volte (verifica in /api/auth/login/start, poi authorize).
  login: { limit: 20, windowSeconds: 15 * 60 },
  code:  { limit: 10, windowSeconds: 15 * 60 },
  send:  { limit: 5,  windowSeconds: 15 * 60 },
};

/**
 * Registra un tentativo e dice se rientra nel limite.
 *
 * @param {keyof LIMITS} action
 * @param {string} key - Di solito l'IP del client.
 * @returns {Promise<boolean>} false se il limite della finestra corrente è superato.
 */
export async function allowAttempt(action, key) {
  const { limit, windowSeconds } = LIMITS[action];
  const windowIndex = Math.floor(Date.now() / (windowSeconds * 1000));
  const doc = await RateLimit.findOneAndUpdate(
    { _id: `${action}:${key}:${windowIndex}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((windowIndex + 1) * windowSeconds * 1000) } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc.count <= limit;
}

/**
 * IP del client dagli header del proxy (Traefik, Vercel). L'app è raggiungibile solo attraverso il
 * proxy, che sovrascrive X-Forwarded-For: altrimenti l'header sarebbe falsificabile.
 *
 * @param {Headers|Record<string, string|string[]|undefined>|undefined} headers - Headers di una
 *   Request, oppure l'oggetto semplice che NextAuth passa ad authorize().
 * @returns {string}
 */
export function clientIp(headers) {
  const get = (name) => (typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]);
  const forwarded = get('x-forwarded-for');
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || get('x-real-ip') || 'unknown';
}
