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

  const handleParsed = (rows) => {
    if (rows.length === 0) {
      setError('Nessuna riga valida trovata. Controlla il template e il file.');
      return;
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
          onSaved={() => router.push('/spese')}
          onBack={() => { setStep(1); setError(''); }}
        />
      )}
    </div>
  );
}
