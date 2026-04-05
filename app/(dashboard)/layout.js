/**
 * @fileoverview Dashboard shell layout — sidebar + main content area.
 * On mobile the sidebar is hidden behind a drawer toggled by a hamburger button.
 */

'use client';

import { useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';

/**
 * Root layout for all authenticated dashboard pages.
 * Renders a fixed sidebar on desktop and a slide-in drawer on mobile.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function DashboardLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer  = useCallback(() => setDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="flex min-h-screen bg-base-100">
      {/* ── Desktop sidebar (always visible ≥ lg) ─────────────────────── */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          {/* Slide-in panel */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar onNavigate={closeDrawer} />
          </div>
        </>
      )}

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-base-200 border-b border-base-300 sticky top-0 z-30">
          <button
            onClick={openDrawer}
            className="btn btn-ghost btn-sm p-1"
            aria-label="Apri menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-bold text-primary">HomeBI</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
