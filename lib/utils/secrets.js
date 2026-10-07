import crypto from 'crypto';

/**
 * Confronta un segreto ricevuto con quello atteso in tempo costante: con `===` il tempo di
 * risposta dipende da quanti caratteri iniziali coincidono, e in teoria si può indovinare il
 * segreto un carattere alla volta.
 *
 * @param {string|null|undefined} received
 * @param {string|null|undefined} expected
 * @returns {boolean} false anche quando `expected` manca: un segreto non configurato non apre nulla.
 */
export function secretMatches(received, expected) {
  if (!expected || typeof received !== 'string') return false;
  const a = crypto.createHash('sha256').update(received).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * @param {Request} req
 * @returns {string|null} Il valore dopo "Bearer " nell'header Authorization.
 */
export function bearerToken(req) {
  const header = req.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}
