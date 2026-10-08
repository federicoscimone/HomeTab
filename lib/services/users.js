/**
 * @fileoverview Regole e validazioni per la gestione degli utenti da parte di un admin.
 * @module lib/services/users
 */

import User from '@/lib/models/User';
import { ROLES } from '@/lib/auth/permissions';
import { isProtectedDemoAccount } from '@/lib/demoAccounts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * @param {object} u - User lean document.
 * @param {string} selfId - Id dell'admin che guarda la lista.
 */
export function toPublicUser(u, selfId) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active !== false,
    mustChangePassword: !!u.mustChangePassword,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt,
    isSelf: String(u._id) === selfId,
    isProtected: isProtectedDemoAccount(u.email),
  };
}

/**
 * @param {object} body
 * @param {boolean} partial - true per le modifiche: valida solo i campi presenti.
 * @returns {{ data?: object, error?: string }} error è una chiave del namespace "errors" di
 *   messages/*.json: la traduce la route.
 */
export function parseUserFields(body, partial = false) {
  const data = {};
  const has = (k) => body?.[k] !== undefined;

  if (!partial || has('name')) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) return { error: 'nameRequired' };
    data.name = name;
  }
  if (!partial || has('email')) {
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) return { error: 'invalidEmail' };
    data.email = email;
  }
  if (!partial || has('role')) {
    if (!ROLES.includes(body?.role)) return { error: 'invalidRole' };
    data.role = body.role;
  }
  if (has('active')) {
    if (typeof body.active !== 'boolean') return { error: 'invalidStatus' };
    data.active = body.active;
  }
  return { data };
}

/**
 * @param {unknown} password
 * @returns {string|null} Chiave d'errore (con il parametro min = MIN_PASSWORD_LENGTH), o null.
 */
export function passwordError(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return 'tempPasswordTooShort';
  }
  return null;
}

/**
 * Vero se togliere `userId` dagli amministratori attivi lascerebbe l'app senza nessuno che
 * possa gestire utenti e impostazioni.
 *
 * @param {string} userId
 */
export async function isLastActiveAdmin(userId) {
  const others = await User.countDocuments({ _id: { $ne: userId }, role: 'admin', active: { $ne: false } });
  return others === 0;
}
