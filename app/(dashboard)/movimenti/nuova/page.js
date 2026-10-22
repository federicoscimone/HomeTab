'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import MovementForm from '@/components/movimenti/MovementForm';
import QuickFill from '@/components/movimenti/QuickFill';
import Link from 'next/link';

export default function NuovaSpesaPage() {
  const t = useTranslations('movements');
  // Una bozza da testo o scontrino rimonta il modulo già compilato: si controlla e si salva.
  const [draft, setDraft] = useState({ key: 0, values: null });
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/movimenti" className="btn btn-ghost btn-sm" aria-label={t('back')}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
      </div>
      <QuickFill onDraft={(values) => setDraft((d) => ({ key: d.key + 1, values }))} />
      <MovementForm key={draft.key} initial={draft.values} />
    </div>
  );
}
