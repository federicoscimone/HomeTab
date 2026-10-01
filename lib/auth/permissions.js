/**
 * @fileoverview Ruoli e permessi: unica fonte di verità, usata da API, proxy e interfaccia.
 * @module lib/auth/permissions
 *
 * Nessuna dipendenza da database, Next o alias `@/`: lo stesso modulo gira nel browser (per
 * nascondere i comandi), nel proxy (per bloccare le pagine) e nelle API (dove sta la protezione
 * vera: nascondere un pulsante non impedisce a nessuno di chiamare la rotta).
 *
 * Per cambiare cosa può fare un ruolo si tocca solo la tabella PERMISSIONS.
 */

/** @typedef {'viewer'|'editor'|'admin'} Role */

/** Ruoli in ordine crescente di privilegi. */
export const ROLES = ['viewer', 'editor', 'admin'];

/** @type {Object<Role, {label: string, description: string}>} */
export const ROLE_INFO = {
  viewer: {
    label: 'Lettore',
    description: 'Vede dashboard, movimenti, report e obiettivi. Non modifica nulla.',
  },
  editor: {
    label: 'Collaboratore',
    description: 'Come il lettore, in più aggiunge, importa e modifica i movimenti. Non li elimina.',
  },
  admin: {
    label: 'Amministratore',
    description: 'Può fare tutto: impostazioni, utenti, obiettivi ed eliminazione dei movimenti.',
  },
};

/**
 * Permesso → ruoli che lo possiedono.
 * @type {Object<string, Role[]>}
 */
export const PERMISSIONS = {
  'data:read':        ['viewer', 'editor', 'admin'],
  'movements:create': ['editor', 'admin'],
  'movements:edit':   ['editor', 'admin'],
  'movements:delete': ['admin'],
  'goals:manage':     ['admin'],
  'settings:manage':  ['admin'],
  'users:manage':     ['admin'],
};

/**
 * @param {string|null|undefined} role
 * @param {string} permission
 * @returns {boolean}
 */
export function can(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) throw new Error(`Permesso sconosciuto: ${permission}`);
  return allowed.includes(role);
}

/**
 * Pagine riservate. Il proxy reindirizza a `fallback` chi non ha il permesso; le API
 * corrispondenti fanno comunque il proprio controllo.
 * @type {{ match: (path: string) => boolean, permission: string, fallback: string }[]}
 */
export const PAGE_RULES = [
  { match: (p) => p === '/impostazioni' || p.startsWith('/impostazioni/'), permission: 'settings:manage', fallback: '/' },
  { match: (p) => p === '/importa' || p.startsWith('/importa/'), permission: 'movements:create', fallback: '/movimenti' },
  { match: (p) => p === '/movimenti/nuova', permission: 'movements:create', fallback: '/movimenti' },
  { match: (p) => /^\/movimenti\/[^/]+$/.test(p), permission: 'movements:edit', fallback: '/movimenti' },
];

/**
 * @param {string} pathname
 * @param {string|null|undefined} role
 * @returns {string|null} Dove reindirizzare, oppure null se la pagina è accessibile.
 */
export function pageRedirectFor(pathname, role) {
  const rule = PAGE_RULES.find((r) => r.match(pathname));
  return rule && !can(role, rule.permission) ? rule.fallback : null;
}
