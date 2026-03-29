import crypto from 'crypto';

/**
 * Genera un token casuale sicuro (32 byte = 64 hex chars).
 * Viene inviato all'utente via email in chiaro.
 */
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash SHA-256 del token da salvare nel DB.
 * Anche se il DB venisse compromesso, i token non sarebbero utilizzabili.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Data di scadenza: ora + minuti indicati (default 60 min).
 */
export function tokenExpiry(minutes = 60) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
