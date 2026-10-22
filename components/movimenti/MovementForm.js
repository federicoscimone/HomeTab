'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PAYMENT_METHODS, getPaymentGroup } from '@/lib/utils/payments';
import { todayString } from '@/lib/utils/comparePeriods';

const EMPTY_FORM = {
  type: 'expense',
  amount: '',
  paymentMethod: 'cash',
  date: '',
  time: '',
  description: '',
  place: '',
  payee: '',
  notes: '',
  categoryId: '',
  subCategory1Id: '',
  subCategory2Id: '',
  excludeFromAnalysis: false,
  goalId: '',
  goalItemId: '',
};

/** Parte tra parentesi di un'etichetta, es. "(opzionale)". */
const muted = (chunks) => <span className="text-base-content/40">{chunks}</span>;

export default function MovementForm({ initial = null, expenseId = null }) {
  const router = useRouter();
  const t = useTranslations('movementForm');
  const tCommon = useTranslations('common');
  const tPay = useTranslations('payments');
  const tGroups = useTranslations('paymentGroups');
  // La data di oggi si calcola quando il form si apre, nell'ora locale. Come costante di modulo
  // restava quella del primo caricamento (sul server, l'avvio del processo) ed era in UTC: tra
  // mezzanotte e l'una, le due con l'ora legale, il form proponeva il giorno prima.
  const [form, setForm] = useState(() => (initial ? {
    ...EMPTY_FORM,
    ...initial,
    type: initial.type || 'expense',
    categoryId:    initial.categoryId?._id    || initial.categoryId    || '',
    subCategory1Id: initial.subCategory1Id?._id || initial.subCategory1Id || '',
    subCategory2Id: initial.subCategory2Id?._id || initial.subCategory2Id || '',
    goalId: initial.goalId?._id || initial.goalId || '',
    goalItemId: initial.goalItemId || '',
    amount: initial.amount?.toString() || '',
  } : { ...EMPTY_FORM, date: todayString() }));

  const [categories, setCategories] = useState([]);
  const [goals, setGoals] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Categorie per livello
  const level1 = categories.filter((c) => c.level === 1);
  const level2 = categories.filter((c) => c.level === 2 && c.parentId?.toString() === form.categoryId);
  const level3 = categories.filter((c) => c.level === 3 && c.parentId?.toString() === form.subCategory1Id);

  useEffect(() => {
    fetch('/api/categorie')
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
    fetch('/api/obiettivi')
      .then((r) => (r.ok ? r.json() : { goals: [] }))
      .then((d) => setGoals(d.goals))
      .catch(() => {});
  }, []);

  // Si collegano a un obiettivo solo le uscite tradizionali: sono le uniche che toccano il risparmio.
  const canLinkGoal = form.type === 'expense' && getPaymentGroup(form.paymentMethod) === 'traditional';
  // Gli obiettivi chiusi restano visibili solo se il movimento è già collegato a uno di loro.
  const goalOptions = goals.filter((g) => g.status === 'active' || g.id === form.goalId);
  const goalItems = goals.find((g) => g.id === form.goalId)?.items ?? [];

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleCategoryChange = (value) => {
    setForm((f) => ({ ...f, categoryId: value, subCategory1Id: '', subCategory2Id: '' }));
  };

  const handleSub1Change = (value) => {
    setForm((f) => ({ ...f, subCategory1Id: value, subCategory2Id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('loading');

    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      paymentGroup: getPaymentGroup(form.paymentMethod),
      time: form.time || null,
      categoryId: form.categoryId || null,
      subCategory1Id: form.subCategory1Id || null,
      subCategory2Id: form.subCategory2Id || null,
      goalId: canLinkGoal ? form.goalId || null : null,
      goalItemId: canLinkGoal && form.goalId ? form.goalItemId || null : null,
    };

    try {
      const res = await fetch(expenseId ? `/api/movimenti/${expenseId}` : '/api/movimenti', {
        method: expenseId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('saveFailed'));
        setStatus('error');
      } else if (expenseId) {
        router.push('/movimenti');
        router.refresh();
      } else {
        setStatus('idle');
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError(tCommon('networkError'));
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      {error && <div className="alert alert-error text-sm py-2"><span>{error}</span></div>}
      {saved && <div className="alert alert-success text-sm py-2"><span>{t('saved')}</span></div>}

      {/* Origine del dato — solo in modifica, se importato */}
      {initial?.source === 'import' && (
        <div className="flex items-center gap-2 text-xs text-base-content/50 -mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>
            {initial.importMethod
              ? t.rich('importedVia', {
                method: t.has(`importMethods.${initial.importMethod}`) ? t(`importMethods.${initial.importMethod}`) : initial.importMethod,
                b: (chunks) => <strong>{chunks}</strong>,
              })
              : t('imported')}
            {initial.importBatchId && <>{' · batch '}<code className="font-mono">{`${initial.importBatchId.slice(0, 8)}…`}</code></>}
          </span>
        </div>
      )}

      {/* Tipo: Uscita / Entrata */}
      <div className="flex gap-2">
        <button
          type="button"
          className={`btn btn-sm flex-1 ${form.type === 'expense' ? 'btn-error' : 'btn-ghost border border-base-300'}`}
          onClick={() => set('type', 'expense')}
        >
          {'↑'} {t('expense')}
        </button>
        <button
          type="button"
          className={`btn btn-sm flex-1 ${form.type === 'income' ? 'btn-success' : 'btn-ghost border border-base-300'}`}
          onClick={() => set('type', 'income')}
        >
          {'↓'} {t('income')}
        </button>
      </div>

      {/* Riga 1: importo + metodo pagamento */}
      <div className="grid grid-cols-2 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">{t('amount')}</span></div>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input input-bordered"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            required
          />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text font-medium">{t('paymentMethod')}</span></div>
          <select
            className="select select-bordered"
            value={form.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value)}
            required
          >
            <optgroup label={tGroups('traditional')}>
              {PAYMENT_METHODS.filter((m) => m.group === 'traditional').map((m) => (
                <option key={m.value} value={m.value}>{tPay(m.value)}</option>
              ))}
            </optgroup>
            <optgroup label={tGroups('alternative')}>
              {PAYMENT_METHODS.filter((m) => m.group === 'alternative').map((m) => (
                <option key={m.value} value={m.value}>{tPay(m.value)}</option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      {/* Riga 2: data + ora */}
      <div className="grid grid-cols-2 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">{t('date')}</span></div>
          <input
            type="date"
            className="input input-bordered"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            required
          />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">{t.rich('time', { muted })}</span></div>
          <input
            type="time"
            className="input input-bordered"
            value={form.time}
            onChange={(e) => set('time', e.target.value)}
          />
        </label>
      </div>

      {/* Riga 3: esercente + luogo */}
      <div className="grid grid-cols-2 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">{t('payee')}</span></div>
          <input
            type="text"
            className="input input-bordered"
            placeholder={t('payeePlaceholder')}
            value={form.payee}
            onChange={(e) => set('payee', e.target.value)}
          />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text font-medium">{t('place')}</span></div>
          <input
            type="text"
            className="input input-bordered"
            placeholder={t('placePlaceholder')}
            value={form.place}
            onChange={(e) => set('place', e.target.value)}
          />
        </label>
      </div>

      {/* Riga 4: causale + note */}
      <div className="grid grid-cols-2 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">{t('description')}</span></div>
          <input
            type="text"
            className="input input-bordered"
            placeholder={t('descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">{t.rich('notes', { muted })}</span></div>
          <input
            type="text"
            className="input input-bordered"
            placeholder={t('notesPlaceholder')}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
      </div>

      {/* Categorie */}
      <div className="grid grid-cols-3 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">{tCommon('category')}</span></div>
          <select
            className="select select-bordered"
            value={form.categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">{tCommon('none')}</option>
            {level1.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">{t.rich('subCategory1', { muted })}</span></div>
          <select
            className="select select-bordered"
            value={form.subCategory1Id}
            onChange={(e) => handleSub1Change(e.target.value)}
            disabled={!form.categoryId || level2.length === 0}
          >
            <option value="">{tCommon('none')}</option>
            {level2.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">{t.rich('subCategory2', { muted })}</span></div>
          <select
            className="select select-bordered"
            value={form.subCategory2Id}
            onChange={(e) => set('subCategory2Id', e.target.value)}
            disabled={!form.subCategory1Id || level3.length === 0}
          >
            <option value="">{tCommon('none')}</option>
            {level3.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Obiettivo pagato con questa spesa */}
      {canLinkGoal && goalOptions.length > 0 && (
        <label className="form-control">
          <div className="label"><span className="label-text">{t.rich('goal', { muted })}</span></div>
          <select
            className="select select-bordered"
            value={form.goalId}
            onChange={(e) => setForm((f) => ({ ...f, goalId: e.target.value, goalItemId: '' }))}
          >
            <option value="">{t('noGoal')}</option>
            {goalOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.status !== 'active' ? `${g.name} ${t('goalClosed')}` : g.name}</option>
            ))}
          </select>
          {/* Fuori da .label: DaisyUI 5 la rende nowrap e la frase uscirebbe dal form. */}
          <p className="text-xs text-base-content/50 mt-1">{t('goalHint')}</p>
        </label>
      )}

      {/* Voce del progetto, se l'obiettivo scelto ne ha */}
      {canLinkGoal && goalItems.length > 0 && (
        <label className="form-control">
          <div className="label"><span className="label-text">{t('goalItem')}</span></div>
          <select className="select select-bordered" value={form.goalItemId} onChange={(e) => set('goalItemId', e.target.value)}>
            <option value="">{t('noGoalItem')}</option>
            {goalItems.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
        </label>
      )}

      {/* Escludi da analisi */}
      <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
        <input
          type="checkbox"
          className="checkbox checkbox-sm mt-0.5"
          checked={!!form.excludeFromAnalysis}
          onChange={(e) => set('excludeFromAnalysis', e.target.checked)}
        />
        <div>
          <p className="text-sm font-medium">{t('exclude')}</p>
          <p className="text-xs text-base-content/50">{t('excludeHint')}</p>
        </div>
      </label>

      {/* Azioni */}
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn btn-primary" disabled={status === 'loading'}>
          {status === 'loading' && <span className="loading loading-spinner loading-sm" />}
          {status === 'loading' ? tCommon('saving') : expenseId ? t('saveChanges') : t('add')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {tCommon('cancel')}
        </button>
      </div>
    </form>
  );
}
