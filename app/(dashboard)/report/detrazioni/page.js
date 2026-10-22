/**
 * @fileoverview Spese detraibili — per il 730: totali per tipo, controllo sul pagamento,
 * l'elenco dei movimenti da tenere pronti e il CSV da portare al CAF o al commercialista.
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';
import useCan from '@/lib/auth/useCan';
import { DEDUCTION_TYPES } from '@/lib/utils/deductions';

const STATUS_BADGE = { ok: 'badge-success', check: 'badge-warning', cash: 'badge-error' };

/** Il CSV con il punto e virgola, come lo apre Excel in italiano. */
function toCsv(rows, headers) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

/** I tipi delle categorie, per gli amministratori: le sottocategorie seguono la madre. */
function MappingCard({ categories, onSaved }) {
  const t = useTranslations('deductions');
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const roots = categories.filter((c) => c.level === 1);
  const current = (c) => (c._id in edits ? edits[c._id] : c.deduction ?? null);

  const put = async (body, ok) => {
    setBusy(true);
    try {
      const res = await fetch('/api/impostazioni/detrazioni', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ kind: 'success', text: ok(data) });
      setEdits({});
      onSaved();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || t('failed') });
    } finally {
      setBusy(false);
    }
  };

  const select = (c, parentType) => (
    <select className="select select-sm w-full sm:w-64" value={current(c) ?? ''} disabled={busy} aria-label={c.name}
      onChange={(e) => setEdits((x) => ({ ...x, [c._id]: e.target.value || null }))}>
      <option value="">{parentType === undefined ? t('notDeductible') : parentType ? t('inherit', { type: t(`types.${parentType}`) }) : t('inheritNone')}</option>
      {DEDUCTION_TYPES.map((d) => <option key={d} value={d}>{t(`types.${d}`)}</option>)}
    </select>
  );

  return (
    <details className="card bg-base-100 shadow-sm">
      <summary className="card-title text-lg cursor-pointer px-8 py-6">{t('mappingTitle')}</summary>
      <div className="card-body gap-3 pt-0">
        <p className="text-xs text-base-content/60">{t('mappingIntro')}</p>
        {message && <div className={`alert py-2 text-sm alert-${message.kind}`}><span>{message.text}</span></div>}
        <ul className="flex flex-col gap-2">
          {roots.map((c) => (
            <li key={c._id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{c.name}</span>{select(c)}</div>
              {categories.filter((s) => s.level === 2 && s.parentId === c._id).map((s) => (
                <div key={s._id} className="flex flex-wrap items-center justify-between gap-2 pl-4">
                  <span className="text-sm text-base-content/70">{s.name}</span>{select(s, current(c))}
                </div>
              ))}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => put({ applyDefaults: true }, (d) => t('defaultsApplied', { n: d.applied }))}>{t('applyDefaults')}</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !Object.keys(edits).length} onClick={() => put({ mappings: edits }, () => t('saved'))}>{t('save')}</button>
        </div>
      </div>
    </details>
  );
}

export default function DetrazioniPage() {
  const t = useTranslations('deductions');
  const tPay = useTranslations('payments');
  const can = useCan();
  const { fmtFull, fmtDate } = useFormat();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear - 1);
  const { data, reload } = useApiData(`/api/report/detrazioni?year=${year}`, 'report/detrazioni');
  const { data: categories, reload: reloadCats } = useApiData(can('settings:manage') ? '/api/categorie' : null, 'categorie');
  const [busy, setBusy] = useState(null);

  const byType = useMemo(() => {
    const map = new Map();
    for (const r of data?.rows ?? []) map.set(r.type, [...(map.get(r.type) ?? []), r]);
    return map;
  }, [data]);

  const setDeduction = async (id, deduction) => {
    setBusy(id);
    try {
      await fetch('/api/report/detrazioni', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movementId: id, deduction }) });
      reload();
    } finally {
      setBusy(null);
    }
  };

  const download = () => {
    const headers = [t('csv.date'), t('csv.text'), t('csv.category'), t('csv.type'), t('csv.method'), t('csv.amount'), t('csv.status')];
    const rows = data.rows.map((r) => [r.date, r.text, r.category, t(`types.${r.type}`), tPay.has(r.paymentMethod) ? tPay(r.paymentMethod) : r.paymentMethod, r.amount.toFixed(2).replace('.', ','), t(`status.${r.status}`)]);
    // Il BOM fa riconoscere a Excel l'UTF-8 (accenti, simbolo dell'euro).
    const blob = new Blob(['﻿', toCsv(rows, headers)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spese-detraibili-${year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-base-content/60">{t('intro')}</p>
        </div>
        <div className="flex gap-2">
          <select className="select select-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('year')}>
            {Array.from({ length: 5 }, (_, i) => thisYear - i).map((y) => <option key={y} value={y}>{String(y)}</option>)}
          </select>
          <button type="button" className="btn btn-outline btn-sm" disabled={!data?.rows.length} onClick={download}>{t('download')}</button>
        </div>
      </div>

      {!data ? <span className="loading loading-spinner" /> : (
        <>
          {!data.mapped && <div className="alert alert-info py-2 text-sm"><span>{t('noMapping')}</span></div>}
          {data.types.length === 0 ? <p className="text-sm text-base-content/60">{t('none', { year: String(year) })}</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.types.map((x) => (
                <div key={x.type} className="rounded-box bg-base-200 p-4">
                  <p className="text-xs text-base-content/60">{t(`types.${x.type}`)}</p>
                  <p className="text-xl font-semibold tabular-nums">{fmtFull(x.total)}</p>
                  <p className="text-xs text-base-content/60">{t('count', { n: x.count })}</p>
                  {x.toCheck > 0 && <p className="text-xs text-warning">{t('toCheck', { amount: fmtFull(x.toCheck) })}</p>}
                  {x.excludedCash > 0 && <p className="text-xs text-error">{t('excludedCash', { amount: fmtFull(x.excludedCash) })}</p>}
                </div>
              ))}
            </div>
          )}

          {[...byType].map(([type, rows]) => (
            <div key={type} className="card bg-base-100 shadow-sm">
              <div className="card-body gap-2">
                <h2 className="font-medium">{t(`types.${type}`)}</h2>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
                          <td className="whitespace-normal">
                            <div>{r.text || '—'}</div>
                            <div className="text-xs text-base-content/50">{[r.category, tPay.has(r.paymentMethod) ? tPay(r.paymentMethod) : r.paymentMethod].filter(Boolean).join(' · ')}</div>
                          </td>
                          <td className="text-right tabular-nums">{fmtFull(r.amount)}</td>
                          <td><span className={`badge badge-sm ${STATUS_BADGE[r.status]}`} title={t(`statusHint.${r.status}`)}>{t(`status.${r.status}`)}</span></td>
                          <td className="text-right">
                            {can('movements:edit') && <button type="button" className="btn btn-ghost btn-xs" disabled={busy === r.id} onClick={() => setDeduction(r.id, 'none')}>{t('exclude')}</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}

          {data.excluded.length > 0 && (
            <details className="card bg-base-100 shadow-sm">
              <summary className="cursor-pointer px-6 py-4 font-medium">{t('excludedTitle', { n: data.excluded.length })}</summary>
              <ul className="px-6 pb-4 text-sm flex flex-col gap-1">
                {data.excluded.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="w-24 text-base-content/60">{fmtDate(r.date)}</span>
                    <span className="flex-1">{r.text}</span>
                    <span className="tabular-nums">{fmtFull(r.amount)}</span>
                    {can('movements:edit') && <button type="button" className="btn btn-ghost btn-xs" disabled={busy === r.id} onClick={() => setDeduction(r.id, null)}>{t('restore')}</button>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="text-xs text-base-content/60 flex flex-col gap-1">
            <p>{t('notes.traceability')}</p>
            <p>{t('notes.notAdvice')}</p>
          </div>
        </>
      )}

      {categories && <MappingCard categories={categories} onSaved={() => { reload(); reloadCats(); }} />}
    </div>
  );
}
