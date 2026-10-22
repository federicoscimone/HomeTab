/**
 * @fileoverview Scadenze — bollette, tasse, polizze e abbonamenti, con la quota da accantonare
 * ogni mese e le spese che si ripetono proposte dai movimenti.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';
import useCan from '@/lib/auth/useCan';
import DeadlineFormModal from '@/components/scadenze/DeadlineFormModal';

export default function ScadenzePage() {
  const t = useTranslations('deadlines');
  const tCommon = useTranslations('common');
  const canEdit = useCan()('movements:edit');
  const { fmtFull, fmtRound, fmtDate } = useFormat();
  const { data, error, reload } = useApiData('/api/scadenze', 'scadenze');
  const { data: sugg, reload: reloadSugg } = useApiData('/api/scadenze/proposte', 'scadenze/proposte');
  const { data: categories } = useApiData('/api/categorie', 'categorie');
  const [editing, setEditing] = useState(null); // null | {} (nuova) | scadenza
  const [ignored, setIgnored] = useState([]);
  const [busy, setBusy] = useState(null);

  const roots = (categories ?? []).filter((c) => c.level === 1);
  const refresh = () => { reload(); reloadSugg(); };

  const call = async (id, url, init) => {
    setBusy(id);
    try {
      const res = await fetch(url, init);
      if (res.ok) refresh();
    } finally {
      setBusy(null);
    }
  };
  // Sparisce subito; il server la ricorda, così non torna alla prossima visita.
  const ignore = (match) => {
    setIgnored((x) => [...x, match]);
    fetch('/api/scadenze/proposte', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ignore: match }),
    }).catch(() => {});
  };
  const markPaid = (d) => call(d.id, `/api/scadenze/${d.id}/pagata`, { method: 'POST' });
  const remove = (d) => {
    if (window.confirm(t('confirmDelete', { title: d.title }))) call(d.id, `/api/scadenze/${d.id}`, { method: 'DELETE' });
  };

  const when = (d) => {
    if (d.daysLeft < 0) return t('overdue', { n: -d.daysLeft });
    if (d.daysLeft === 0) return t('today');
    return t('inDays', { n: d.daysLeft });
  };

  if (error) return <div className="alert alert-error"><span>{t('loadFailed')}</span></div>;
  if (!data) return <span className="loading loading-spinner" />;

  const active = data.deadlines.filter((d) => d.active);
  const closed = data.deadlines.filter((d) => !d.active);
  const suggestions = (sugg?.suggestions ?? []).filter((s) => !ignored.includes(s.match));

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-base-content/60">{t('intro')}</p>
        </div>
        {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}>{t('new')}</button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-box bg-primary/10 p-4">
          <p className="text-xs text-base-content/60">{t('reserveTitle')}</p>
          <p className="text-2xl font-semibold text-primary tabular-nums">{fmtRound(data.totals.monthlyReserve)}</p>
          <p className="text-xs text-base-content/60">{t('reserveHint')}</p>
        </div>
        <div className="rounded-box bg-base-200 p-4">
          <p className="text-xs text-base-content/60">{t('soonTitle')}</p>
          <p className="text-2xl font-semibold tabular-nums">{fmtRound(data.totals.soonAmount)}</p>
          <p className="text-xs text-base-content/60">{t('soonCount', { n: data.totals.soonCount })}</p>
        </div>
        <div className={`rounded-box p-4 ${data.totals.overdue ? 'bg-warning/15' : 'bg-base-200'}`}>
          <p className="text-xs text-base-content/60">{t('overdueTitle')}</p>
          <p className="text-2xl font-semibold tabular-nums">{data.totals.overdue}</p>
          <p className="text-xs text-base-content/60">{t('overdueHint')}</p>
        </div>
      </div>

      {canEdit && suggestions.length > 0 && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <div>
              <h2 className="card-title text-lg">{t('suggestTitle')}</h2>
              <p className="text-sm text-base-content/60">{t('suggestIntro')}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <li key={s.match} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{s.title}</span>
                  <span className="text-base-content/70">
                    {t('suggestLine', { amount: fmtFull(s.amount), every: t('periods.every', { n: s.everyMonths }), date: fmtDate(s.nextDate), times: s.occurrences })}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button" className="btn btn-outline btn-xs"
                    onClick={() => setEditing({ title: s.title, amount: s.amount, everyMonths: s.everyMonths, nextDate: s.nextDate, categoryId: s.categoryId, match: s.match })}
                  >
                    {t('suggestAdd')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => ignore(s.match)}>{t('suggestIgnore')}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-2">
          {active.length === 0 ? <p className="text-sm text-base-content/60">{t('empty')}</p> : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{t('cols.what')}</th>
                    <th>{t('cols.when')}</th>
                    <th className="text-right">{t('cols.amount')}</th>
                    <th className="text-right">{t('cols.reserve')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {active.map((d) => (
                    <tr key={d.id} className={d.daysLeft < 0 && !d.payment ? 'bg-warning/10' : ''}>
                      <td className="whitespace-normal">
                        <div className="font-medium">{d.title}</div>
                        <div className="text-xs text-base-content/60">
                          {[t(`kinds.${d.kind}`), d.everyMonths ? t('periods.every', { n: d.everyMonths }) : t('periods.once'), d.categoryName].filter(Boolean).join(' · ')}
                        </div>
                        {d.payment && (
                          <div className="text-xs text-success">
                            {t('paymentFound', { date: fmtDate(d.payment.date), amount: fmtFull(d.payment.amount) })}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{fmtDate(d.nextDate)}</div>
                        <div className={`text-xs ${d.daysLeft < 0 ? 'text-warning' : 'text-base-content/60'}`}>{when(d)}</div>
                      </td>
                      <td className="text-right tabular-nums">{d.amount != null ? fmtFull(d.amount) : '—'}</td>
                      <td className="text-right tabular-nums">{d.reserve ? t('perMonth', { amount: fmtFull(d.reserve) }) : '—'}</td>
                      <td className="text-right whitespace-nowrap">
                        {canEdit && (
                          <span className="flex justify-end gap-1">
                            <button type="button" className={`btn btn-xs ${d.payment || d.daysLeft <= 0 ? 'btn-success' : 'btn-ghost'}`} disabled={busy === d.id} onClick={() => markPaid(d)}>
                              {t('markPaid')}
                            </button>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditing(d)}>{tCommon('edit')}</button>
                            <button type="button" className="btn btn-ghost btn-xs text-error" disabled={busy === d.id} onClick={() => remove(d)}>{tCommon('delete')}</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-base-content/60">{t('remindNote')}</p>
        </div>
      </div>

      {closed.length > 0 && (
        <details className="card bg-base-100 shadow-sm">
          <summary className="cursor-pointer px-6 py-4 font-medium">{t('closedTitle', { n: closed.length })}</summary>
          <ul className="px-6 pb-4 text-sm flex flex-col gap-1">
            {closed.map((d) => (
              <li key={d.id} className="flex items-center gap-3">
                <span>{d.title}</span>
                <span className="text-base-content/60">{fmtDate(d.nextDate)}</span>
                {canEdit && <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => remove(d)}>{tCommon('delete')}</button>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && (
        <DeadlineFormModal
          initial={editing.title || editing.id ? editing : null}
          categories={roots}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}
