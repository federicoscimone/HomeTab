'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';
import useCan from '@/lib/auth/useCan';

const BAR = { ok: 'progress-success', warning: 'progress-warning', over: 'progress-error' };

/** Il modale dei budget: una riga per categoria, con la media degli ultimi 3 mesi accanto. */
function BudgetModal({ data, onClose, onSaved }) {
  const t = useTranslations('budgets');
  const tCommon = useTranslations('common');
  const { fmtRound } = useFormat();
  const current = new Map(data.budgets.map((b) => [b.categoryId, String(b.amount)]));
  const [values, setValues] = useState(() => Object.fromEntries(data.categories.map((c) => [c.id, current.get(c.id) ?? ''])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    const budgets = data.categories
      .filter((c) => (values[c.id] || '') !== (current.get(c.id) ?? ''))
      .map((c) => ({ categoryId: c.id, amount: values[c.id] === '' ? null : Number(values[c.id].replace(',', '.')) }));
    if (!budgets.length) return onClose();
    setBusy(true);
    try {
      const res = await fetch('/api/budget', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ budgets }) });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (err) {
      setError(err.message || t('failed'));
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-lg">
        <h3 className="font-bold text-lg mb-1">{t('modalTitle')}</h3>
        <p className="text-xs text-base-content/60 mb-3">{t('modalIntro')}</p>
        {error && <div className="alert alert-error py-2 text-sm mb-2"><span>{error}</span></div>}
        <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {data.categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">
                {c.name}
                {c.average > 0 && <span className="block text-xs text-base-content/50">{t('average', { amount: fmtRound(c.average) })}</span>}
              </span>
              {c.suggested && !values[c.id] && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setValues((v) => ({ ...v, [c.id]: String(c.suggested) }))}>
                  {t('useSuggested', { amount: fmtRound(c.suggested) })}
                </button>
              )}
              <input className="input input-sm w-28" inputMode="decimal" placeholder={t('none')} aria-label={c.name}
                value={values[c.id]} onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))} />
            </li>
          ))}
        </ul>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{tCommon('cancel')}</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{tCommon('save')}</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

/** I budget del mese: barre, stima a fine mese, e il modale per impostarli. */
export default function BudgetCard() {
  const t = useTranslations('budgets');
  const canManage = useCan()('goals:manage');
  const { fmtRound } = useFormat();
  const { data, reload } = useApiData('/api/budget', 'budget');
  const [open, setOpen] = useState(false);
  if (!data || (!data.budgets.length && !canManage)) return null;

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="card-title text-lg">{t('title')}</h2>
            <p className="text-sm text-base-content/60">{t('intro')}</p>
          </div>
          {canManage && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>{data.budgets.length ? t('edit') : t('set')}</button>}
        </div>
        {data.budgets.length === 0 ? <p className="text-sm text-base-content/60">{t('empty')}</p> : (
          <ul className="flex flex-col gap-3">
            {data.budgets.map((b) => (
              <li key={b.categoryId} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{b.name}</span>
                  <span className="tabular-nums">{t('spentOf', { spent: fmtRound(b.spent), amount: fmtRound(b.amount), pct: b.pct })}</span>
                </div>
                <progress className={`progress w-full ${BAR[b.level]}`} value={Math.min(b.pct, 100)} max={100} aria-label={b.name} />
                {b.projected != null && b.projected > b.amount && (
                  <span className="text-xs text-warning">{t('projectedOver', { amount: fmtRound(b.projected) })}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {data.budgets.length > 0 && <p className="text-xs text-base-content/50">{t('alertsNote')}</p>}
      </div>
      {open && <BudgetModal data={data} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </div>
  );
}
