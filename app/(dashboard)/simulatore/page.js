/**
 * @fileoverview «E se…?» — l'effetto di una decisione sul risparmio e sugli obiettivi: una rata,
 * un taglio a una categoria, entrate che cambiano, una spesa straordinaria. Senza IA.
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';
import { addMonths } from '@/lib/utils/goalMath';

const TYPES = ['installment', 'category', 'income', 'oneOff'];

/** I campi di un cambiamento come li scrive il modulo (stringhe), per tipo. */
const blank = (type, start) => ({
  type, amount: '', percent: '', mode: 'percent', categoryId: '', from: addMonths(start, 1), months: '', income: false,
});

/** Dal modulo all'API: numeri veri, campi che non servono tolti. Null se manca qualcosa. */
function toChange(c) {
  const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
  const months = num(c.months);
  const base = { type: c.type, from: c.from || null, months: months ? Math.round(months) : null };
  if (c.type === 'category') {
    if (!c.categoryId) return null;
    const v = num(c.mode === 'percent' ? c.percent : c.amount);
    if (v == null || Number.isNaN(v)) return null;
    return c.mode === 'percent' ? { ...base, categoryId: c.categoryId, percent: v } : { ...base, categoryId: c.categoryId, amount: v };
  }
  const amount = num(c.amount);
  if (amount == null || Number.isNaN(amount)) return null;
  return c.type === 'oneOff' ? { ...base, amount, income: c.income, months: null } : { ...base, amount };
}

export default function SimulatorePage() {
  const t = useTranslations('simulator');
  const tStates = useTranslations('goalStates');
  const { fmtRound, fmtMonthText } = useFormat();
  const { data: base } = useApiData('/api/simulatore', 'simulatore');
  const [changes, setChanges] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const valid = changes.map(toChange);
  const payload = valid.every(Boolean) && valid.length ? JSON.stringify({ changes: valid }) : null;

  // Si ricalcola da solo mentre si scrive, con un attimo di pausa: è un conto, non costa nulla.
  useEffect(() => {
    if (!payload) return undefined;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/simulatore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setResult(data);
        setError(null);
      } catch (err) {
        setError(err.message || t('failed'));
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [payload, t]);

  if (!base) return <span className="loading loading-spinner" />;

  const set = (i, field, value) => setChanges((list) => list.map((c, j) => (j === i ? { ...c, [field]: value } : c)));
  const add = (type) => setChanges((list) => [...list, blank(type, base.start)]);
  const remove = (i) => setChanges((list) => list.filter((_, j) => j !== i));
  const preset = (c) => setChanges((list) => [...list, { ...blank(c.type, base.start), ...c }]);
  const restaurants = base.categories.find((c) => /ristor|cibo pronto|restaurant/i.test(c.name));

  const shown = payload ? result : null;
  const diff = (r) => r.after - r.before;
  const tone = (d) => (d > 0 ? 'text-success' : d < 0 ? 'text-error' : '');

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-base-content/60">{t('intro', { avg: fmtRound(base.avgSavings) })}</p>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-base-content/60 self-center">{t('presets')}</span>
            <button type="button" className="btn btn-outline btn-xs" onClick={() => preset({ type: 'installment', amount: '300', months: '48' })}>{t('presetCar')}</button>
            {restaurants && (
              <button type="button" className="btn btn-outline btn-xs" onClick={() => preset({ type: 'category', categoryId: restaurants.id, percent: '-30' })}>
                {t('presetCut', { category: restaurants.name })}
              </button>
            )}
            <button type="button" className="btn btn-outline btn-xs" onClick={() => preset({ type: 'income', amount: '-600', from: `${Number(base.start.slice(0, 4)) + 1}-01` })}>{t('presetPartTime')}</button>
            <button type="button" className="btn btn-outline btn-xs" onClick={() => preset({ type: 'oneOff', amount: '1500', from: `${base.start.slice(0, 4)}-12` })}>{t('presetOneOff')}</button>
          </div>

          {changes.map((c, i) => (
            <div key={i} className="rounded-box border border-base-300 p-3 flex flex-wrap items-end gap-3">
              <span className="badge badge-ghost self-center">{t(`types.${c.type}`)}</span>
              {c.type === 'category' && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs">{t('fields.category')}</span>
                  <select className="select select-sm w-52" value={c.categoryId} onChange={(e) => set(i, 'categoryId', e.target.value)}>
                    <option value="">{t('fields.choose')}</option>
                    {base.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{t('fields.categoryOption', { name: cat.name, avg: fmtRound(cat.monthly) })}</option>
                    ))}
                  </select>
                </label>
              )}
              {c.type === 'category' && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs">{t('fields.mode')}</span>
                  <select className="select select-sm w-28" value={c.mode} onChange={(e) => set(i, 'mode', e.target.value)}>
                    <option value="percent">{t('fields.percent')}</option>
                    <option value="amount">{t('fields.amountMonth')}</option>
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-xs">{t(`fields.value.${c.type === 'category' ? c.mode : c.type}`)}</span>
                <input
                  className="input input-sm w-32" inputMode="decimal"
                  value={c.type === 'category' && c.mode === 'percent' ? c.percent : c.amount}
                  onChange={(e) => set(i, c.type === 'category' && c.mode === 'percent' ? 'percent' : 'amount', e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs">{t(c.type === 'oneOff' ? 'fields.when' : 'fields.from')}</span>
                <input type="month" className="input input-sm w-40" value={c.from} onChange={(e) => set(i, 'from', e.target.value)} />
              </label>
              {c.type !== 'oneOff' && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs">{t('fields.months')}</span>
                  <input className="input input-sm w-24" inputMode="numeric" placeholder={t('fields.forever')} value={c.months} onChange={(e) => set(i, 'months', e.target.value)} />
                </label>
              )}
              {c.type === 'oneOff' && (
                <label className="flex items-center gap-2 text-sm self-center">
                  <input type="checkbox" className="checkbox checkbox-sm" checked={c.income} onChange={(e) => set(i, 'income', e.target.checked)} />
                  {t('fields.isIncome')}
                </label>
              )}
              <span className="flex-1" />
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => remove(i)}>{t('remove')}</button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {TYPES.map((type) => (
              <button key={type} type="button" className="btn btn-ghost btn-sm" onClick={() => add(type)}>{t('add', { type: t(`types.${type}`) })}</button>
            ))}
          </div>
          {changes.length > 0 && !payload && <p className="text-xs text-base-content/60">{t('incomplete')}</p>}
          {error && <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>}
        </div>
      </div>

      {shown && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[['yearEnd', shown.yearEnd], ['next12', shown.next12]].map(([key, r]) => (
                <div key={key} className="rounded-box bg-base-200 p-4">
                  <p className="text-xs text-base-content/60">{t(`results.${key}`)}</p>
                  <p className="text-lg tabular-nums">
                    {fmtRound(r.before)}{' → '}<span className="font-semibold">{fmtRound(r.after)}</span>
                  </p>
                  <p className={`text-sm tabular-nums ${tone(diff(r))}`}>{t('results.diff', { amount: fmtRound(diff(r)) })}</p>
                </div>
              ))}
            </div>

            {shown.goals.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>{t('results.goal')}</th>
                      <th>{t('results.deadline')}</th>
                      <th>{t('results.before')}</th>
                      <th>{t('results.after')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.goals.map((g) => (
                      <tr key={g.name}>
                        <td className="font-medium">{g.name}</td>
                        <td>{fmtMonthText(g.deadline)}</td>
                        <td>{g.before ? fmtMonthText(g.before) : t('results.never')}</td>
                        <td className={g.shift > 0 ? 'text-error' : g.shift < 0 ? 'text-success' : ''}>
                          {g.after ? fmtMonthText(g.after) : t('results.never')}
                          {g.shift ? <span className="block text-xs">{t(g.shift > 0 ? 'results.shiftLater' : 'results.shiftEarlier', { n: Math.abs(g.shift) })}</span> : null}
                        </td>
                        <td>
                          <span className={`badge badge-sm ${g.onTimeAfter ? 'badge-success' : 'badge-warning'}`}>
                            {tStates(`${g.onTimeAfter ? 'on_track' : 'behind'}.label`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-base-content/60">{t('how')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
