'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/** Corpo JSON della risposta; in caso di errore, il messaggio del server. */
async function jsonOrThrow(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || '');
  return body;
}

const modelName = (spec) => spec.slice(spec.indexOf(':') + 1);

/** Lo storico di un modello, dal più recente: ogni riga con la freccia rispetto alla precedente. */
function ModelHistory({ spec, entries }) {
  const t = useTranslations('settingsAi');
  const { fmtDate, fmtUsd } = useFormat();
  const rows = entries.map((e, i) => ({ ...e, prev: entries[i - 1] })).reverse();
  const arrow = (e) => {
    if (!e.prev) return '';
    if (e.input > e.prev.input || e.output > e.prev.output) return '▲';
    if (e.input < e.prev.input || e.output < e.prev.output) return '▼';
    return '=';
  };
  return (
    <li className="flex flex-col gap-1">
      <span className="font-mono text-sm">{modelName(spec)}</span>
      <table className="table table-xs">
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap w-28">{fmtDate(e.effectiveFrom)}</td>
              <td className="tabular-nums whitespace-nowrap">{t('pricePair', { input: fmtUsd(e.input), output: fmtUsd(e.output) })}</td>
              <td className={arrow(e) === '▲' ? 'text-error' : arrow(e) === '▼' ? 'text-success' : 'text-base-content/40'}>{arrow(e)}</td>
              <td className="text-base-content/60">
                {e.url ? <a className="link link-hover" href={e.url} target="_blank" rel="noreferrer">{t(`priceSources.${e.source}`)}</a> : t(`priceSources.${e.source}`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </li>
  );
}

/**
 * «Aggiorna i prezzi»: rilegge le pagine ufficiali, mostra le differenze già verificate e le
 * applica solo su conferma. Sotto, lo storico dei prezzi modello per modello.
 *
 * @param {{ data: object, disabled: boolean, onApplied: () => Promise<void> }} props
 */
export default function AiPrices({ data, disabled, onApplied }) {
  const t = useTranslations('settingsAi');
  const { fmtDateTime, fmtDate, fmtUsd } = useFormat();
  const [busy, setBusy] = useState(null); // 'check' | 'apply' | null
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState(null);
  const [checkedAt, setCheckedAt] = useState(data.pricesCheckedAt);
  const aiOn = data.import.available;

  const loadHistory = async () => {
    const res = await jsonOrThrow(await fetch('/api/ai/prices/history', { cache: 'no-store' }));
    setHistory(res.models);
    setCheckedAt(res.checkedAt);
  };

  const check = async () => {
    setBusy('check');
    setMessage(null);
    setResult(null);
    try {
      const res = await jsonOrThrow(await fetch('/api/ai/prices/check', { method: 'POST' }));
      setResult(res);
      setCheckedAt(new Date().toISOString());
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || t('pricesFailed') });
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy('apply');
    try {
      await jsonOrThrow(await fetch('/api/ai/prices/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkId: result.checkId }),
      }));
      setResult(null);
      setMessage({ kind: 'success', text: t('pricesApplied') });
      await onApplied();
      if (history) await loadHistory();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || t('pricesFailed') });
    } finally {
      setBusy(null);
    }
  };

  const pair = (p) => t('pricePair', { input: fmtUsd(p.input), output: fmtUsd(p.output) });

  return (
    <section className="rounded-xl border border-base-200 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{t('pricesTitle')}</h3>
          <p className="text-xs text-base-content/60">
            {checkedAt ? t('pricesChecked', { date: fmtDateTime(checkedAt) }) : t('pricesNever')}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-outline" disabled={disabled || !aiOn || Boolean(busy)} onClick={check}
          title={aiOn ? undefined : t('pricesNeedAi')}>
          {busy === 'check' && <span className="loading loading-spinner loading-xs" />}
          {busy === 'check' ? t('pricesChecking') : t('pricesCheck')}
        </button>
      </div>
      <p className="text-xs text-base-content/60">{t('pricesIntro')}</p>
      {message && <div className={`alert py-2 text-sm alert-${message.kind}`} role="status"><span>{message.text}</span></div>}

      {result && (
        <div className="flex flex-col gap-2 text-sm">
          {result.changes.length === 0
            ? <div className="alert alert-success py-2"><span>{t('pricesNoChanges', { n: result.unchanged.length })}</span></div>
            : (
              <>
                <p>{t('pricesChanges', { n: result.changes.length })}</p>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead><tr><th>{t('priceCols.model')}</th><th>{t('priceCols.now')}</th><th>{t('priceCols.new')}</th></tr></thead>
                    <tbody>
                      {result.changes.map((c) => (
                        <tr key={c.spec}>
                          <td className="font-mono whitespace-nowrap">
                            {c.url ? <a className="link link-hover" href={c.url} target="_blank" rel="noreferrer">{modelName(c.spec)}</a> : modelName(c.spec)}
                          </td>
                          <td className="tabular-nums whitespace-nowrap text-base-content/60">{c.current ? pair(c.current) : '—'}</td>
                          <td className="tabular-nums">
                            <div className="whitespace-nowrap font-medium">{pair(c.found)}</div>
                            {c.upcoming && (
                              <div className="text-xs text-warning">{t('pricesUpcoming', { date: fmtDate(c.upcoming.from), price: pair(c.upcoming) })}</div>
                            )}
                            <div className="text-xs text-base-content/50 max-w-md whitespace-normal" title={c.quote}>{`«${c.quote.slice(0, 140)}${c.quote.length > 140 ? '…' : ''}»`}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-sm btn-ghost" disabled={Boolean(busy)} onClick={() => setResult(null)}>{t('pricesDiscard')}</button>
                  <button type="button" className="btn btn-sm btn-primary" disabled={disabled || Boolean(busy)} onClick={apply}>
                    {busy === 'apply' && <span className="loading loading-spinner loading-xs" />}
                    {t('pricesApply')}
                  </button>
                </div>
              </>
            )}
          {result.rejected.length > 0 && (
            <p className="text-xs text-base-content/60">{t('pricesRejected', { models: result.rejected.map((r) => modelName(r.spec)).join(', ') })}</p>
          )}
          {result.errors.length > 0 && (
            <p className="text-xs text-warning">{t('pricesErrors', { providers: result.errors.map((e) => data.catalog.find((p) => p.id === e.provider)?.label ?? e.provider).join(', ') })}</p>
          )}
          <p className="text-xs text-base-content/50">{t('pricesCost', { cost: fmtUsd(result.costUsd) })}</p>
        </div>
      )}

      <details onToggle={(e) => { if (e.currentTarget.open && !history) loadHistory().catch(() => setHistory([])); }}>
        <summary className="cursor-pointer text-sm font-medium">{t('historyTitle')}</summary>
        {!history ? <span className="loading loading-spinner loading-xs mt-2" /> : history.length === 0
          ? <p className="text-xs text-base-content/60 mt-2">{t('historyEmpty')}</p>
          : <ul className="flex flex-col gap-3 mt-2">{history.map((m) => <ModelHistory key={m.spec} {...m} />)}</ul>}
      </details>
    </section>
  );
}
