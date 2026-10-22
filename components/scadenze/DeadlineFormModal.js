/**
 * @fileoverview DeadlineFormModal — creazione e modifica di una scadenza.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DEADLINE_KINDS, PERIODS } from '@/lib/utils/deadlines';

/**
 * @param {object}   props
 * @param {object}   [props.initial]    - Scadenza da modificare, o i campi proposti per una nuova.
 * @param {object[]} props.categories   - Categorie di primo livello, per collegarla.
 * @param {Function} props.onSaved
 * @param {Function} props.onClose
 */
export default function DeadlineFormModal({ initial = null, categories, onSaved, onClose }) {
  const t = useTranslations('deadlines');
  const tCommon = useTranslations('common');
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    kind: initial?.kind ?? 'bill',
    amount: initial?.amount != null ? String(initial.amount) : '',
    everyMonths: initial?.everyMonths === null ? '' : String(initial?.everyMonths ?? 12),
    nextDate: initial?.nextDate ?? '',
    remindDays: String(initial?.remindDays ?? 7),
    categoryId: initial?.categoryId ? String(initial.categoryId) : '',
    match: initial?.match ?? '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(editing ? `/api/scadenze/${initial.id}` : '/api/scadenze', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          kind: form.kind,
          amount: form.amount === '' ? null : Number(form.amount.replace(',', '.')),
          everyMonths: form.everyMonths === '' ? null : Number(form.everyMonths),
          nextDate: form.nextDate,
          remindDays: Number(form.remindDays),
          categoryId: form.categoryId || null,
          match: form.match,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('saveFailed'));
        setSaving(false);
        return;
      }
      onSaved(data);
    } catch {
      setError(tCommon('networkError'));
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <form className="modal-box w-11/12 max-w-lg" onSubmit={handleSubmit}>
        <h3 className="font-bold text-lg mb-4">{editing ? t('form.editTitle') : t('form.newTitle')}</h3>
        {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('form.title')}</span>
            <input
              type="text" className="input w-full" maxLength={100} required autoFocus
              placeholder={t('form.titlePlaceholder')}
              value={form.title} onChange={(e) => set('title', e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('form.kind')}</span>
              <select className="select w-full" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                {DEADLINE_KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('form.amount')}</span>
              <input
                type="number" step="0.01" min="0" className="input w-full" inputMode="decimal"
                value={form.amount} onChange={(e) => set('amount', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('form.nextDate')}</span>
              <input type="date" className="input w-full" required value={form.nextDate} onChange={(e) => set('nextDate', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('form.every')}</span>
              <select className="select w-full" value={form.everyMonths} onChange={(e) => set('everyMonths', e.target.value)}>
                <option value="">{t('periods.once')}</option>
                {PERIODS.map((p) => <option key={p} value={p}>{t('periods.every', { n: p })}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('form.remind')}</span>
              <select className="select w-full" value={form.remindDays} onChange={(e) => set('remindDays', e.target.value)}>
                {[0, 1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d ? t('form.remindDays', { n: d }) : t('form.noRemind')}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t('form.category')}</span>
              <select className="select w-full" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">{t('form.noCategory')}</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('form.match')}</span>
            <input
              type="text" className="input w-full" maxLength={60} placeholder={t('form.matchPlaceholder')}
              value={form.match} onChange={(e) => set('match', e.target.value)}
            />
            <span className="text-xs text-base-content/60">{t('form.matchHint')}</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('form.notes')}</span>
            <textarea className="textarea w-full" maxLength={500} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{tCommon('cancel')}</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : tCommon('save')}
          </button>
        </div>
      </form>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
