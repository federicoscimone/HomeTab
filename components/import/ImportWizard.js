'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import StepUpload from '@/components/import/StepUpload';
import StepReview from '@/components/import/StepReview';

/**
 * Procedura di import in due passi: caricamento del file, poi revisione delle righe.
 *
 * @param {object} props
 * @param {string|null} props.sampleHref - Estratto conto di esempio da scaricare (solo nella demo).
 */
export default function ImportWizard({ sampleHref }) {
  const router = useRouter();
  const t = useTranslations('import');
  const tCommon = useTranslations('common');
  const [step, setStep] = useState(1); // 1 = upload, 2 = review, 3 = completato
  // null finché la richiesta non risponde: una lista vuota vuol dire "nessun template", e prima
  // la pagina lo diceva anche durante il caricamento.
  const [templates, setTemplates] = useState(null);
  const [categories, setCategories] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const json = (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    };
    Promise.all([
      fetch('/api/impostazioni/template-import').then(json),
      fetch('/api/categorie').then(json),
    ]).then(([tpl, cat]) => {
      setTemplates(tpl);
      setCategories(cat);
    }).catch((err) => {
      console.error('[importa] load error:', err);
      setTemplates([]);
      setError(tCommon('loadError'));
    });
  }, [tCommon]);

  const handleParsed = async (rows, { aiAvailable: ai = false } = {}) => {
    if (rows.length === 0) {
      setError(t('noValidRows'));
      return;
    }

    // Controlla duplicati rispetto al DB prima di mostrare la schermata di revisione
    try {
      const res = await fetch('/api/import/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rows.map(r => ({ date: r.date, amount: r.amount, payee: r.payee, description: r.description })),
        }),
      });
      if (res.ok) {
        const { duplicates } = await res.json();
        rows = rows.map((r, i) => ({
          ...r,
          _isDuplicate: duplicates[i] === true,
          // Auto-deseleziona i duplicati (coerente con "Salta duplicati" attivo di default)
          selected: duplicates[i] === true ? false : r.selected,
        }));
      }
    } catch {
      // Errore non bloccante: si procede senza flag duplicati
    }

    setParsedRows(rows);
    setAiAvailable(ai);
    setStep(2);
  };

  return (
    <div className="max-w-5xl">
      {/* Header + breadcrumb step */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <ul className="steps steps-horizontal mt-3 text-xs">
          <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>{t('steps.upload')}</li>
          <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>{t('steps.review')}</li>
          <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>{t('steps.done')}</li>
        </ul>
      </div>

      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs ml-auto" onClick={() => setError('')} aria-label={tCommon('close')}>{'✕'}</button>
        </div>
      )}

      {step === 1 && (
        <StepUpload
          templates={templates}
          sampleHref={sampleHref}
          onParsed={handleParsed}
          onError={setError}
        />
      )}

      {step >= 2 && (
        <StepReview
          rows={parsedRows}
          categories={categories}
          aiAvailable={aiAvailable}
          onImported={() => setStep(3)}
          onSaved={() => router.push('/movimenti')}
          onBack={() => { setStep(1); setError(''); }}
        />
      )}
    </div>
  );
}
