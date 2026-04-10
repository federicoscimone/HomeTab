'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PAYMENT_METHODS, getPaymentGroup } from '@/lib/utils/payments';

const EMPTY_FORM = {
  type: 'expense',
  amount: '',
  paymentMethod: 'cash',
  date: new Date().toISOString().split('T')[0],
  time: '',
  description: '',
  place: '',
  payee: '',
  notes: '',
  categoryId: '',
  subCategory1Id: '',
  subCategory2Id: '',
  excludeFromAnalysis: false,
};

export default function MovementForm({ initial = null, expenseId = null }) {
  const router = useRouter();
  const [form, setForm] = useState(initial ? {
    ...EMPTY_FORM,
    ...initial,
    type: initial.type || 'expense',
    categoryId:    initial.categoryId?._id    || initial.categoryId    || '',
    subCategory1Id: initial.subCategory1Id?._id || initial.subCategory1Id || '',
    subCategory2Id: initial.subCategory2Id?._id || initial.subCategory2Id || '',
    amount: initial.amount?.toString() || '',
  } : EMPTY_FORM);

  const [categories, setCategories] = useState([]);
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
  }, []);

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
    };

    try {
      const res = await fetch(expenseId ? `/api/movimenti/${expenseId}` : '/api/movimenti', {
        method: expenseId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante il salvataggio');
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
      setError('Errore di rete. Riprova.');
      setStatus('error');
    }
  };

  const importMethodLabel = { xlsx: 'Excel (.xlsx)', csv: 'CSV', paste: 'Copia-incolla' };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      {error && <div className="alert alert-error text-sm py-2"><span>{error}</span></div>}
      {saved && <div className="alert alert-success text-sm py-2"><span>Movimento salvato.</span></div>}

      {/* Origine del dato — solo in modifica, se importato */}
      {initial?.source === 'import' && (
        <div className="flex items-center gap-2 text-xs text-base-content/50 -mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>
            Importato
            {initial.importMethod && <> via <strong>{importMethodLabel[initial.importMethod] || initial.importMethod}</strong></>}
            {initial.importBatchId && <> · batch <code className="font-mono">{initial.importBatchId.slice(0, 8)}…</code></>}
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
          ↑ Uscita
        </button>
        <button
          type="button"
          className={`btn btn-sm flex-1 ${form.type === 'income' ? 'btn-success' : 'btn-ghost border border-base-300'}`}
          onClick={() => set('type', 'income')}
        >
          ↓ Entrata
        </button>
      </div>

      {/* Riga 1: importo + metodo pagamento */}
      <div className="grid grid-cols-2 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">Importo (€) *</span></div>
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
          <div className="label"><span className="label-text font-medium">Metodo di pagamento *</span></div>
          <select
            className="select select-bordered"
            value={form.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value)}
            required
          >
            <optgroup label="Tradizionali">
              {PAYMENT_METHODS.filter((m) => m.group === 'traditional').map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
            <optgroup label="Alternativi">
              {PAYMENT_METHODS.filter((m) => m.group === 'alternative').map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      {/* Riga 2: data + ora */}
      <div className="grid grid-cols-2 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">Data *</span></div>
          <input
            type="date"
            className="input input-bordered"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            required
          />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">Ora <span className="text-base-content/40">(opzionale)</span></span></div>
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
          <div className="label"><span className="label-text font-medium">Esercente</span></div>
          <input
            type="text"
            className="input input-bordered"
            placeholder="Es. Esselunga, Amazon…"
            value={form.payee}
            onChange={(e) => set('payee', e.target.value)}
          />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text font-medium">Luogo</span></div>
          <input
            type="text"
            className="input input-bordered"
            placeholder="Es. Milano, Online…"
            value={form.place}
            onChange={(e) => set('place', e.target.value)}
          />
        </label>
      </div>

      {/* Riga 4: causale + note */}
      <div className="grid grid-cols-2 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">Causale</span></div>
          <input
            type="text"
            className="input input-bordered"
            placeholder="Descrizione del movimento"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">Note <span className="text-base-content/40">(opzionali)</span></span></div>
          <input
            type="text"
            className="input input-bordered"
            placeholder="Informazioni aggiuntive…"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
      </div>

      {/* Categorie */}
      <div className="grid grid-cols-3 gap-4">
        <label className="form-control">
          <div className="label"><span className="label-text font-medium">Categoria</span></div>
          <select
            className="select select-bordered"
            value={form.categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">— Nessuna —</option>
            {level1.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">Sotto-categoria 1 <span className="text-base-content/40">(opz.)</span></span></div>
          <select
            className="select select-bordered"
            value={form.subCategory1Id}
            onChange={(e) => handleSub1Change(e.target.value)}
            disabled={!form.categoryId || level2.length === 0}
          >
            <option value="">— Nessuna —</option>
            {level2.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="form-control">
          <div className="label"><span className="label-text">Sotto-categoria 2 <span className="text-base-content/40">(opz.)</span></span></div>
          <select
            className="select select-bordered"
            value={form.subCategory2Id}
            onChange={(e) => set('subCategory2Id', e.target.value)}
            disabled={!form.subCategory1Id || level3.length === 0}
          >
            <option value="">— Nessuna —</option>
            {level3.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Escludi da analisi */}
      <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
        <input
          type="checkbox"
          className="checkbox checkbox-sm mt-0.5"
          checked={!!form.excludeFromAnalysis}
          onChange={(e) => set('excludeFromAnalysis', e.target.checked)}
        />
        <div>
          <p className="text-sm font-medium">Escludi dalle analisi</p>
          <p className="text-xs text-base-content/50">Questo movimento non verrà conteggiato nel dashboard e nei report (es. vendita casa, auto)</p>
        </div>
      </label>

      {/* Azioni */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className={`btn btn-primary ${status === 'loading' ? 'loading' : ''}`}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Salvataggio…' : expenseId ? 'Salva modifiche' : 'Aggiungi movimento'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          Annulla
        </button>
      </div>
    </form>
  );
}
