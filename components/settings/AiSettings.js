'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import AiConfigCard from '@/components/settings/AiConfigCard';
import AiCard from '@/components/settings/AiCard';

/** Pagina Impostazioni → IA: configurazione, poi stato e spesa. Una sola richiesta per entrambe. */
export default function AiSettings() {
  const t = useTranslations('settingsAi');
  const { data: loaded, error } = useApiData('/api/ai/settings', 'ai-settings');
  // Dopo un salvataggio il server restituisce la vista aggiornata: si usa quella, senza ricaricare.
  const [saved, setSaved] = useState(null);
  const data = saved ?? loaded;

  if (error) return <div className="alert alert-error py-2 text-sm"><span>{t('loadFailed')}</span></div>;
  if (!data) return <span className="loading loading-spinner loading-md" />;
  return (
    <>
      <AiConfigCard data={data} onSaved={setSaved} />
      <AiCard data={data} />
    </>
  );
}
