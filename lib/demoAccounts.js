/**
 * @fileoverview Account della vetrina, protetti quando l'app gira in DEMO_MODE.
 * @module lib/demoAccounts
 *
 * Chiunque visiti la demo entra come amministratore: senza protezione potrebbe cambiare la
 * password di Mario, declassarlo o disattivarlo, e la vetrina resterebbe chiusa per tutti fino
 * al prossimo seed. Gli utenti creati dai visitatori invece si gestiscono normalmente.
 */

/** Password comune a tutti gli account della vetrina (solo dati fittizi). */
export const DEMO_PASSWORD = 'Asdf_lkjH';

export const DEMO_ACCOUNTS = [
  { name: 'Mario',  email: 'mario@test.it',  role: 'admin' },
  { name: 'Lucia',  email: 'lucia@test.it',  role: 'editor' },
  { name: 'Giulia', email: 'giulia@test.it', role: 'viewer' },
];

/**
 * @param {string|null|undefined} email
 * @returns {boolean} true se l'account non va toccato (solo in DEMO_MODE).
 */
export function isProtectedDemoAccount(email) {
  return process.env.DEMO_MODE === 'true'
    && DEMO_ACCOUNTS.some((a) => a.email === String(email ?? '').toLowerCase());
}
