/**
 * @fileoverview Application sidebar — navigation, theme toggle, user info.
 * On mobile it is rendered inside a drawer managed by DashboardLayout.
 */

'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

/**
 * @typedef {Object} NavChild
 * @property {string} href  - Destination URL.
 * @property {string} label - Display label.
 */

/**
 * @typedef {Object} NavItem
 * @property {string}          [href]     - URL (leaf items only).
 * @property {string}          label      - Display label.
 * @property {React.ReactNode} icon       - SVG icon element.
 * @property {NavChild[]}      [children] - Sub-items (section group).
 */

/** @type {NavItem[]} */
const NAV_ITEMS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/movimenti',
    label: 'Movimenti',
    quickAdd: '/movimenti/nuova',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/importa',
    label: 'Importa',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    label: 'Report',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    children: [
      { href: '/report',           label: 'Pivot Mensile' },
      { href: '/report/categorie', label: 'Per Categoria' },
      { href: '/report/analisi',   label: 'Analisi Avanzata' },
    ],
  },
  {
    label: 'Impostazioni',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    children: [
      { href: '/impostazioni',                  label: 'Account & Sicurezza' },
      { href: '/impostazioni/categorie',         label: 'Categorie' },
      { href: '/impostazioni/metodi-pagamento',  label: 'Metodi Pagamento' },
      { href: '/impostazioni/template-import',   label: 'Template Import' },
      { href: '/impostazioni/keyword-mapping',   label: 'Keyword Mapping' },
      { href: '/impostazioni/audit-log',         label: 'Audit Log' },
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

  return (
    <aside className="w-64 min-h-screen bg-base-200 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-base-300">
        <span className="text-xl font-bold text-primary">HomeBI</span>
        <p className="text-xs text-base-content/60 mt-0.5">Movimenti Personali</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navigazione principale">
        {NAV_ITEMS.map((item) =>
          item.children ? (
            <div key={item.label}>
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wider mt-3 mb-1">
                {item.icon}
                {item.label}
              </div>
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
                  {child.label}
                </Link>
              ))}
            </div>
          ) : item.quickAdd ? (
            <div key={item.href} className={`flex items-center rounded-lg transition-colors ${isActive(item.href) ? 'bg-primary text-primary-content' : 'hover:bg-base-500 text-base-content'}`}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium flex-1 min-w-0"
              >
                {item.icon}
                {item.label}
              </Link>
              <Link
                href={item.quickAdd}
                onClick={onNavigate}
                className={`px-2.5 py-2.5 rounded-r-lg text-lg leading-none transition-colors ${isActive(item.href) ? 'bg-primary-focus/30 hover:bg-primary-content/20' : 'bg-base-500 hover:bg-base-content/15'}`}
                aria-label={`Nuova ${item.label}`}
                title={`Nuova ${item.label}`}
              >
                +
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
              {item.label}
            </Link>
          ),
        )}
      </nav>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-base-300">
        {session?.user && (
          <div className="flex items-center gap-2 mb-3">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-8">
                <span className="text-xs">{session.user.name?.[0]?.toUpperCase() || 'U'}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-base-content/40 truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="btn btn-ghost btn-sm w-full justify-start text-base-content/50 gap-2"
          aria-label="Disconnetti"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Disconnetti
        </button>
      </div>
    </aside>
  );
}
