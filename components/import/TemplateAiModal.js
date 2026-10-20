'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/** Il testo inviato con i segnaposto evidenziati. */
function Masked({ value }) {
  const text = String(value ?? '');
  return text.split(/(\[[A-Z]+\])/).map((part, i) => (
    /^\[[A-Z]+\]$/.test(part)
      ? <span key={i} className="badge badge-warning badge-xs font-mono mx-0.5">{part}</span>
      : <span key={i}>{part}</span>
  ));
}

/** Tabella di righe con le lettere delle colonne in testa. */
function Grid({ columns, rows, masked = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-xs">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i === 0 ? 'font-semibold' : ''}>
              {columns.map((c, j) => (
                <td key={c} className={masked ? 'font-mono' : 'text-base-content/60'}>
                  {masked ? <Masked value={row[c]} /> : row[j]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Proposta di template con l'IA. Prima «Vedi cosa viene inviato» (nessun invio), poi «Proponi»;
 * la proposta torna già verificata con il parser vero e si apre nel modulo del template, dove
 * l'utente la controlla e la salva.
 *
 * @param {{ onUse: (template: object) => void, onClose: () => void }} props
 */
export default function TemplateAiModal({ onUse, onClose }) {
  const t = useTranslations('templatesAi');
  const tCommon = useTranslations('common');
  const tPay = useTranslations('payments');
  const { fmtFull, fmtUsd } = useFormat();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null); // 'preview' | 'propose'
  const [error, setError] = useState('');

  const send = async (action) => {
    setBusy(action);
    setError('');
    if (action === 'propose') setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('action', action);
    try {
      const res = await fetch('/api/impostazioni/template-import/suggest', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('failed'));
      if (action === 'preview') setPreview(data);
      else setResult(data);
    } catch (err) {
      setError(err.message || t('failed'));
    } finally {
      setBusy(null);
    }
  };

  const pickFile = (f) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');
  };

  const sent = preview?.sent;
  const sentRows = sent ? [sent.titles ?? {}, ...sent.rows] : [];
  const check = result?.check;
  const tpl = result?.template;
  const mapping = tpl
    ? [
      ...Object.entries(tpl.columnMapping).filter(([, v]) => v).map(([k, v]) => [t(`fields.${k}`), v]),
      ...(tpl.amountDebit ? [[t('fields.amountDebit'), tpl.amountDebit]] : []),
      ...(tpl.amountCredit ? [[t('fields.amountCredit'), tpl.amountCredit]] : []),
    ]
    : [];

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="tpl-ai-title">
      <div className="modal-box max-w-5xl">
        <h3 id="tpl-ai-title" className="font-bold text-lg">{t('title')}</h3>
        <p className="text-sm text-base-content/70 mt-1">{t('intro')}</p>

        <div className="flex flex-col gap-2 md:flex-row md:items-center mt-4">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="file-input file-input-sm w-full md:flex-1"
            aria-label={t('file')}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" disabled={!file || busy} onClick={() => send('preview')}>
              {busy === 'preview' && <span className="loading loading-spinner loading-xs" />}
              {t('previewButton')}
            </button>
            <button className="btn btn-info btn-sm" disabled={!file || busy || !preview?.available} onClick={() => send('propose')}>
              {busy === 'propose' && <span className="loading loading-spinner loading-xs" />}
              {t('proposeButton')}
            </button>
          </div>
        </div>
        <p className="text-xs text-base-content/60 mt-1">{t('previewFirst')}</p>

        {error && <div className="alert alert-error text-sm py-2 mt-4"><span>{error}</span></div>}

        {preview && (
          <div className="flex flex-col gap-3 mt-4">
            <div className="alert text-sm py-2">
              <span>
                {t('previewSummary', { omitted: sent.rowsOmittedAboveTitles, rows: sent.rows.length, columns: sent.columns.length })}
                {!preview.available && ` ${t('aiOff')}`}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="text-xs font-medium mb-1">{t('original')}</p>
                <Grid columns={sent.columns} rows={preview.originalRows} />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">{t('sent')}</p>
                <Grid columns={sent.columns} rows={sentRows} masked />
              </div>
            </div>
            <details className="collapse collapse-arrow border border-base-200">
              <summary className="collapse-title text-sm font-medium">{t('raw')}</summary>
              <div className="collapse-content">
                <pre className="text-xs whitespace-pre-wrap bg-base-200 rounded p-3 max-h-[35vh] overflow-auto">
                  {JSON.stringify({ system: preview.system, message: sent }, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3 mt-4 border-t border-base-200 pt-4">
            <h4 className="font-semibold">{t('proposalTitle', { name: tpl.name })}</h4>
            <div className={`alert text-sm py-2 ${check.parsed > 0 && check.parsed >= check.dataRows ? 'alert-success' : 'alert-warning'}`}>
              <span>{t('checkSummary', { parsed: check.parsed, dataRows: check.dataRows })}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {mapping.map(([label, col]) => (
                <span key={label} className="badge badge-outline">{`${label}: ${col}`}</span>
              ))}
              <span className="badge badge-outline">{`${t('fields.dateFormat')}: ${tpl.dateFormat}`}</span>
              <span className="badge badge-outline">{`${t('fields.amountSign')}: ${t(`signs.${tpl.amountSign}`)}`}</span>
              <span className="badge badge-outline">{`${t('fields.skipRows')}: ${tpl.skipRows}`}</span>
              {tpl.defaultPaymentMethod && <span className="badge badge-outline">{tPay(tpl.defaultPaymentMethod)}</span>}
              {tpl.payeeMethodKeywords.map((k) => (
                <span key={k.keyword} className="badge badge-ghost">{`${k.keyword} → ${tPay(k.method)}`}</span>
              ))}
            </div>
            {result.notes && <p className="text-xs text-base-content/70">{t('notes', { notes: result.notes })}</p>}
            {check.sample.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>{t('sample.date')}</th>
                      <th>{t('sample.description')}</th>
                      <th>{t('sample.method')}</th>
                      <th className="text-right">{t('sample.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.sample.map((r, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{r.date}</td>
                        <td>{[r.payee, r.description].filter(Boolean).join(' · ')}</td>
                        <td>{r.paymentMethod ? tPay(r.paymentMethod) : '—'}</td>
                        <td className={`text-right whitespace-nowrap ${r.type === 'income' ? 'text-success' : 'text-error'}`}>
                          {`${r.type === 'income' ? '+' : '-'}${fmtFull(r.amount)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-base-content/60">{t('cost', { cost: fmtUsd(result.costUsd), model: result.model })}</p>
          </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>{tCommon('close')}</button>
          {result && (
            <button className="btn btn-primary" onClick={() => onUse(result.template)}>{t('use')}</button>
          )}
        </div>
      </div>
      <button className="modal-backdrop" aria-label={tCommon('close')} onClick={onClose} />
    </div>
  );
}
