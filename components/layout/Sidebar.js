/**
 * @fileoverview Application sidebar — navigation, theme toggle, user info.
 * On mobile it is rendered inside a drawer managed by DashboardLayout.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import packageJson from '@/package.json';
import useCan from '@/lib/auth/useCan';
import LocaleSwitcher from '@/components/layout/LocaleSwitcher';

/**
 * @typedef {Object} NavChild
 * @property {string} href  - Destination URL.
 * @property {string} label - Chiave in messages/*.json, sezione nav.
 */

/**
 * @typedef {Object} NavItem
 * @property {string}          [href]     - URL (leaf items only).
 * @property {string}          label      - Chiave in messages/*.json, sezione nav.
 * @property {React.ReactNode} icon       - SVG icon element.
 * @property {NavChild[]}      [children] - Sub-items (section group).
 * @property {string}          [permission] - Permesso richiesto per vedere la voce (lib/auth/permissions).
 * @property {boolean}         [collapsible] - Gruppo chiuso di default, si apre al click.
 */

/** @type {NavItem[]} */
const NAV_ITEMS = [
  {
    href: '/',
    label: 'dashboard',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/movimenti',
    label: 'movements',
    quickAdd: '/movimenti/nuova',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/importa',
    label: 'import',
    permission: 'movements:create',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    href: '/obiettivi',
    label: 'goals',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V4m0 0h11l-1.5 4L14 12H3" />
      </svg>
    ),
  },
  {
    label: 'reports',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    children: [
      { href: '/report',           label: 'pivot' },
      { href: '/report/categorie', label: 'byCategory' },
      { href: '/report/analisi',   label: 'analysis' },
      { href: '/report/famiglie-simili', label: 'similarHouseholds' },
    ],
  },
  {
    label: 'settings',
    permission: 'settings:manage',
    collapsible: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    children: [
      { href: '/impostazioni/utenti',           label: 'users' },
      { href: '/impostazioni',                  label: 'backup' },
      { href: '/impostazioni/categorie',         label: 'categories' },
      { href: '/impostazioni/metodi-pagamento',  label: 'paymentMethods' },
      { href: '/impostazioni/template-import',   label: 'importTemplates' },
      { href: '/impostazioni/keyword-mapping',   label: 'keywordMapping' },
      { href: '/impostazioni/ia',                label: 'ai' },
      { href: '/impostazioni/audit-log',         label: 'auditLog' },
    ],
  },
];

/**
 * Paths that require an exact pathname match to be considered "active".
 * All others use `startsWith`.
 */
// Paths where startsWith would cause false positives:
// - '/'          → matches every route
// - '/report'    → matches /report/categorie, /report/analisi
// - '/impostazioni' → matches all settings sub-pages
const EXACT_MATCH_PATHS = ['/', '/impostazioni', '/report'];

/**
 * Application sidebar component.
 *
 * @param {{ onNavigate?: () => void }} props
 *   `onNavigate` — optional callback invoked after a nav link is clicked
 *   (used by the mobile drawer to close itself on navigation).
 */
export default function Sidebar({ onNavigate }) {
  const pathname           = usePathname();
  const { data: session }  = useSession();
  const canDo              = useCan();
  const t                  = useTranslations('nav');
  const tRoles             = useTranslations('roles');
  const tCommon            = useTranslations('common');
  const navItems           = NAV_ITEMS.filter((item) => !item.permission || canDo(item.permission));
  // Scelte esplicite dell'utente sui gruppi richiudibili; finché non tocca nulla, un gruppo è
  // aperto solo se contiene la pagina corrente (così la voce attiva non resta nascosta).
  const [groupToggles, setGroupToggles] = useState({});
  const [menuOpen, setMenuOpen]         = useState(false);
  const userBoxRef                      = useRef(null);

  // Il menu utente si chiude cliccando fuori o con Esc. I listener esistono solo mentre è aperto.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (e) => { if (!userBoxRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  /**
   * Returns whether a nav item href is the currently active route.
   *
   * @param {string} href
   * @returns {boolean}
   */
  const isActive = useCallback(
    (href) => {
      if (EXACT_MATCH_PATHS.includes(href)) return pathname === href;
      return pathname.startsWith(href);
    },
    [pathname],
  );

  /** @param {NavItem} item */
  const isGroupOpen = (item) => {
    if (!item.collapsible) return true;
    return groupToggles[item.label] ?? item.children.some((c) => isActive(c.href));
  };
  const toggleGroup = (item) =>
    setGroupToggles((t) => ({ ...t, [item.label]: !isGroupOpen(item) }));

  return (
    // Alta quanto lo schermo: scorre solo la navigazione, il piede con l'utente resta sempre visibile.
    <aside className="w-64 h-dvh bg-base-200 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-base-300 shrink-0">
        <span className="text-xl font-bold text-primary">{'HomeTab'}</span>
        <p className="text-xs text-base-content/60 mt-0.5">{tCommon('tagline')}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1" aria-label={t('main')}>
        {navItems.map((item) =>
          item.children ? (
            <div key={item.label}>
              {item.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(item)}
                  aria-expanded={isGroupOpen(item)}
                  aria-controls={`nav-group-${item.label}`}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-3 mb-1 rounded-lg hover:bg-base-300 hover:text-base-content/70 transition-colors"
                >
                  {item.icon}
                  <span className="flex-1 text-left">{t(item.label)}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isGroupOpen(item) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-3 mb-1">
                  {item.icon}
                  {t(item.label)}
                </div>
              )}
              {isGroupOpen(item) && (
              <div id={`nav-group-${item.label}`}>
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ml-2 ${
                    isActive(child.href)
                      ? 'bg-primary text-primary-content font-medium'
                      : 'hover:bg-base-500 text-base-content'
                  }`}
                >
                  {t(child.label)}
                </Link>
              ))}
              </div>
              )}
            </div>
          ) : item.quickAdd && canDo('movements:create') ? (
            <div key={item.href} className={`flex items-center rounded-lg transition-colors ${isActive(item.href) ? 'bg-primary text-primary-content' : 'hover:bg-base-500 text-base-content'}`}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium flex-1 min-w-0"
              >
                {item.icon}
                {t(item.label)}
              </Link>
              <Link
                href={item.quickAdd}
                onClick={onNavigate}
                className={`px-2.5 py-2.5 rounded-r-lg text-lg leading-none transition-colors ${isActive(item.href) ? 'bg-primary-focus/30 hover:bg-primary-content/20' : 'bg-base-500 hover:bg-base-content/15'}`}
                aria-label={t('newMovement')}
                title={t('newMovement')}
              >
                <span aria-hidden="true">{'+'}</span>
              </Link>
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive(item.href)
                  ? 'bg-primary text-primary-content font-medium'
                  : 'hover:bg-base-300 text-base-content'
              }`}
            >
              {item.icon}
              {t(item.label)}
            </Link>
          ),
        )}
      </nav>

      {/* Utente: piede fisso, con menu contestuale (verso l'alto) e uscita a sola icona */}
      <div ref={userBoxRef} className="relative px-3 pt-3 pb-2 border-t border-base-300 shrink-0">
        {menuOpen && (
          <ul
            role="menu"
            aria-label={t('userMenu')}
            className="menu absolute bottom-full left-3 right-3 mb-1 bg-base-100 rounded-box shadow-lg border border-base-300 z-10 p-1"
          >
            <li role="none">
              <Link
                role="menuitem"
                href="/account"
                onClick={() => { setMenuOpen(false); onNavigate?.(); }}
                className={`gap-2 text-sm ${isActive('/account') ? 'menu-active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t('myAccount')}
              </Link>
            </li>
          </ul>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 flex-1 min-w-0 rounded-lg px-2 py-1.5 text-left hover:bg-base-300 transition-colors"
          >
            <span className="w-8 h-8 shrink-0 rounded-full bg-primary text-primary-content grid place-items-center text-xs font-semibold" aria-hidden="true">
              {session?.user?.name?.[0]?.toUpperCase() || 'U'}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium truncate">{session?.user?.name}</span>
              <span className="block text-xs text-base-content/40 truncate">
                {session?.user?.role ? tRoles(`${session.user.role}.label`) : session?.user?.email}
              </span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 shrink-0 text-base-content/40 transition-transform ${menuOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-error"
            aria-label={t('signOut')}
            title={t('signOut')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1 px-2">
          <p className="text-[11px] text-base-content/40">{tCommon('version', { version: packageJson.version })}</p>
          <LocaleSwitcher saveToAccount />
        </div>
      </div>
    </aside>
  );
}
