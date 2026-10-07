/**
 * @fileoverview Stato attuale dell'utente di una sessione, letto dal database.
 * @module lib/auth/sessionUser
 *
 * La sessione è un JWT valido 30 giorni: se ruolo, attivazione e password provvisoria venissero
 * letti dal token, un utente declassato o disattivato conserverebbe i vecchi privilegi fino alla
 * scadenza. Per questo il token porta solo id e versione di sessione, e il resto si rilegge qui a
 * ogni richiesta: una query per richiesta è un costo trascurabile per un'app familiare.
 */

import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

/**
 * @typedef {Object} SessionUser
 * @property {string}  id
 * @property {string}  name
 * @property {string}  email
 * @property {'viewer'|'editor'|'admin'} role
 * @property {boolean} mustChangePassword
 * @property {'it'|'en'|null} locale - Lingua salvata sul profilo, se l'utente ne ha scelta una.
 */

/**
 * @param {string|undefined} userId       - Dal token.
 * @param {number|undefined} tokenVersion - `sv` dal token; assente nei token emessi prima dei ruoli.
 * @returns {Promise<SessionUser|null>} null se l'utente non esiste, è disattivato o la sessione è
 *   stata revocata da un cambio password.
 */
export async function loadSessionUser(userId, tokenVersion) {
  if (!userId) return null;
  await connectDB();
  const user = await User.findById(userId)
    .select('name email role active mustChangePassword sessionVersion locale')
    .lean();

  if (!user || user.active === false) return null;
  if ((user.sessionVersion ?? 0) !== (tokenVersion ?? 0)) return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: !!user.mustChangePassword,
    locale: user.locale ?? null,
  };
}
