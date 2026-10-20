'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/** Il testo originale di una riga, come appare nella revisione. */
const originalText = (r) => [r.description, r.payee, r.place].filter(Boolean).join(' | ');

/** Il testo inviato con i segnaposto evidenziati, per vedere a colpo d'occhio cosa è stato tolto. */
function Masked({ text }) {
  return text.split(/(\[[A-Z]+\])/).map((part, i) => (
    /^\[[A-Z]+\]$/.test(part)
      ? <span key={i} className="badge badge-warning badge-xs font-mono mx-0.5">{part}</span>
      : <span key={i}>{part}</span>
  ));
}

/**
 * Anteprima di ciò che partirebbe verso il modello, senza inviarlo.
 * Le righe originali restano nel browser: il server riceve gli stessi campi della chiamata vera
 * e restituisce la richiesta già mascherata, prodotta dalla stessa funzione.
 *
 * @param {{ rows: object[], onClose: () => void }} props - Righe della revisione da suggerire.
 */
export default function AiPreviewModal({ rows, onClose }) {
  const t = useTranslations('importAi');
  const tCommon = useTranslations('common');
  const { fmtFull } = useFormat();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/import/suggest/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: rows.map((r) => ({
        id: r._rowId, description: r.description, payee: r.payee, place: r.place, type: r.type, amount: r.amount,
      })) }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((err) => { if (err.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [rows]);

  const byId = new Map(rows.map((r) => [r._rowId, r]));
  const items = data?.batches.flatMap((b) => b.items) ?? [];

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="ai-preview-title">
      <div className="modal-box max-w-5xl">
        <h3 id="ai-preview-title" className="font-bold text-lg">{t('previewTitle')}</h3>
        <p className="text-sm text-base-content/70 mt-1">{t('previewIntro')}</p>

        {error && <div className="alert alert-error text-sm py-2 mt-4"><span>{t('previewFailed')}</span></div>}
        {!data && !error && <span className="loading loading-spinner loading-md mt-4" />}

        {data && (
          <div className="flex flex-col gap-4 mt-4">
            <div className="alert text-sm py-2">
              <span>
                {data.available
                  ? t('previewSummary', { requests: data.batches.length, model: data.model, rows: rows.length, distinct: items.length, examples: data.examples.length, categories: data.categories.length })
                  : t('previewSummaryOff', { requests: data.batches.length, rows: rows.length, distinct: items.length, examples: data.examples.length, categories: data.categories.length })}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[45vh]">
              <table className="table table-xs table-pin-rows">
                <thead>
                  <tr>
                    <th>{t('previewCols.original')}</th>
                    <th>{t('previewCols.sent')}</th>
                    <th className="text-right">{t('previewCols.amount')}</th>
                    <th className="text-right">{t('previewCols.rows')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const first = byId.get(it.rowIds[0]);
                    return (
                      <tr key={`${it.id}`}>
                        <td className="text-base-content/60 max-w-xs">{first ? originalText(first) : ''}</td>
                        <td className="font-mono max-w-xs"><Masked text={it.text} /></td>
                        <td className="text-right whitespace-nowrap">{`${it.type === 'income' ? '+' : '-'}${fmtFull(it.amount)}`}</td>
                        <td className="text-right">{it.rowIds.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <details className="collapse collapse-arrow border border-base-200">
              <summary className="collapse-title text-sm font-medium">{t('previewExamples', { count: data.examples.length })}</summary>
              <div className="collapse-content text-xs">
                <p className="text-base-content/60 mb-2">{t('previewExamplesHint')}</p>
                <ul className="font-mono grid md:grid-cols-2 gap-x-4">
                  {data.examples.map((e) => (
                    <li key={`${e.text}-${e.type}`}><Masked text={e.text} />{` → ${e.category}`}</li>
                  ))}
                </ul>
              </div>
            </details>

            <details className="collapse collapse-arrow border border-base-200">
              <summary className="collapse-title text-sm font-medium">{t('previewRaw')}</summary>
              <div className="collapse-content">
                <pre className="text-xs whitespace-pre-wrap bg-base-200 rounded p-3 max-h-[40vh] overflow-auto">
                  {JSON.stringify({
                    system: data.system,
                    requests: data.batches.map((b) => ({ max_tokens: b.maxTokens, message: JSON.parse(b.prompt) })),
                  }, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}

        <div className="modal-action">
          <button className="btn" onClick={onClose}>{tCommon('close')}</button>
        </div>
      </div>
      <button className="modal-backdrop" aria-label={tCommon('close')} onClick={onClose} />
    </div>
  );
}
