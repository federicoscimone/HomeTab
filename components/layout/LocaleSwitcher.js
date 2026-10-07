/**
 * @fileoverview Selettore della lingua dell'interfaccia (IT / EN).
 *
 * La scelta va nel cookie, che il server legge a ogni richiesta (i18n/request.js), e poi si
 * ricaricano dal server i componenti della pagina: niente ricaricamento completo, lo stato dei
 * componenti client resta. Per un utente collegato si salva anche nel profilo, così email e
 * notifiche gli arrivano nella stessa lingua.
 */

'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALES, LOCALE_COOKIE } from '@/lib/i18n/locale';

/** Fuori dal componente: le regole di React vietano di modificare document.cookie durante il render. */
function persistLocale(locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * @param {{ saveToAccount?: boolean, className?: string }} props
 *   saveToAccount — true dove c'è una sessione: salva la scelta anche sull'utente.
 */
export default function LocaleSwitcher({ saveToAccount = false, className = '' }) {
  const locale = useLocale();
  const t = useTranslations('locale');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next) => {
    if (next === locale) return;
    persistLocale(next);
    if (saveToAccount) {
      fetch('/api/account/locale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      }).catch(() => { /* il cookie basta per l'interfaccia: il profilo si riallinea al prossimo cambio */ });
    }
    startTransition(() => router.refresh());
  };

  return (
    <div role="group" aria-label={t('label')} className={`join ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={t(`names.${l}`)}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => choose(l)}
          className={`btn btn-xs join-item ${l === locale ? 'btn-active' : 'btn-ghost'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
