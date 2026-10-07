/**
 * @fileoverview Il mio account — profilo, tema, cambio password e uscita. Aperta a tutti i ruoli:
 * le Impostazioni sono solo per gli amministratori, ma la propria password la cambia ognuno.
 */

'use client';

import { useState, useSyncExternalStore } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import ChangePasswordForm from '@/components/account/ChangePasswordForm';
import LocaleSwitcher from '@/components/layout/LocaleSwitcher';

const THEMES = [
  { value: 'light',  label: 'Light',  bg: '#ffffff', primary: '#6366f1', text: '#1f2937' },
  { value: 'dark',   label: 'Dark',   bg: '#1d232a', primary: '#661ae6', text: '#a6adbb' },
  { value: 'forest', label: 'Forest', bg: '#171212', primary: '#1eb854', text: '#b5b5b5' },
  { value: 'aqua',   label: 'Aqua',   bg: '#345da7', primary: '#09ecf3', text: '#c3f0fb' },
  { value: 'abyss',  label: 'Abyss',  bg: '#0a0a14', primary: '#4f46e5', text: '#8b8ba8' },
];

/**
 * Il tema attivo è l'attributo data-theme di <html>, impostato dal root layout leggendo il cookie:
 * lo si osserva da lì invece di copiarlo in uno stato React che potrebbe divergere.
 */
function subscribeTheme(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
const currentTheme = () => document.documentElement.getAttribute('data-theme');

/**
 * Applica e salva il tema. Il cookie serve al root layout per renderizzare già il tema giusto
 * lato server; sta fuori dal componente perché le regole di React vietano di modificare valori
 * globali come document.cookie dentro un componente.
 */
function persistTheme(value) {
  document.documentElement.setAttribute('data-theme', value);
  localStorage.setItem('hometab-theme', value);
  document.cookie = `hometab-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function AccountPage() {
  const { data: session } = useSession();
  // Sul server il tema non si conosce (null): nessun bottone risulta attivo finché non si idrata.
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => null);
  const [message, setMessage] = useState('');
  const t = useTranslations('account');
  const tRoles = useTranslations('roles');

  const roleKey = session?.user?.role;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* Profilo */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body gap-2">
          <h2 className="card-title text-lg">{session?.user?.name}</h2>
          <p className="text-sm text-base-content/60">{session?.user?.email}</p>
          {roleKey && (
            <p className="text-sm">
              <span className="badge badge-outline mr-2">{tRoles(`${roleKey}.label`)}</span>
              <span className="text-base-content/60">{tRoles(`${roleKey}.description`)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Tema */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body gap-4">
          <h2 className="card-title text-lg">{t('theme.title')}</h2>
          <div className="flex flex-wrap gap-3">
            {THEMES.map(th => (
              <button
                key={th.value}
                onClick={() => persistTheme(th.value)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${theme === th.value ? 'border-primary' : 'border-base-200 hover:border-base-300'}`}
                title={th.label}
              >
                <span
                  className="w-14 h-9 rounded-lg flex items-end p-1 gap-0.5"
                  style={{ backgroundColor: th.bg }}
                >
                  <span className="flex-1 h-3 rounded-sm opacity-80" style={{ backgroundColor: th.primary }} />
                  <span className="flex-1 h-2 rounded-sm opacity-40" style={{ backgroundColor: th.text }} />
                </span>
                <span className="text-xs font-medium">{th.label}</span>
                {theme === th.value && (
                  <span className="badge badge-primary badge-xs">{t('theme.active')}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lingua */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body gap-3">
          <h2 className="card-title text-lg">{t('language.title')}</h2>
          <p className="text-xs text-base-content/50">{t('language.hint')}</p>
          <LocaleSwitcher saveToAccount className="w-fit" />
        </div>
      </div>

      {/* Cambio password */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body gap-4">
          <h2 className="card-title text-lg">{t('password.title')}</h2>
          <p className="text-xs text-base-content/50">{t('password.hint')}</p>
          {message && <div className="alert alert-success py-2 text-sm"><span>{message}</span></div>}
          {session?.user?.email && (
            <ChangePasswordForm
              email={session.user.email}
              onDone={() => setMessage(t('password.done'))}
            />
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mt-4">
        <div className="card-body">
          <h2 className="card-title text-lg">{t('session.title')}</h2>
          <p className="text-sm text-base-content/60">{t('session.text')}</p>
          <button
            className="btn btn-outline btn-error btn-sm w-fit"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            {t('session.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
