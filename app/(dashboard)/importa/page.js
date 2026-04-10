'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StepUpload from '@/components/import/StepUpload';
import StepReview from '@/components/import/StepReview';

export default function ImportaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = upload, 2 = review
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/impostazioni/template-import').then(r => r.json()),
      fetch('/api/categorie').then(r => r.json()),
    ]).then(([t, c]) => {
      setTemplates(t);
      setCategories(c);
    }).catch(() => {});
  }, []);

  const handleParsed = async (rows) => {
    if (rows.length === 0) {
      setError('Nessuna riga valida trovata. Controlla il template e il file.');
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
    setStep(2);
  };

  return (
    <div className="max-w-5xl">
      {/* Header + breadcrumb step */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Importa Movimenti</h1>
        <ul className="steps steps-horizontal mt-3 text-xs">
          <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>Carica file</li>
          <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>Revisione</li>
          <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>Completato</li>
        </ul>
      </div>

      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs ml-auto" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {step === 1 && (
        <StepUpload
          templates={templates}
          onParsed={handleParsed}
          onError={setError}
        />
      )}

      {step === 2 && (
        <StepReview
          rows={parsedRows}
          categories={categories}
          onSaved={() => router.push('/movimenti')}
          onBack={() => { setStep(1); setError(''); }}
        />
      )}
    </div>
  );
}
