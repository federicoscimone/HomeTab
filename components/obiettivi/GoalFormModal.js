/**
 * @fileoverview GoalFormModal — creazione e modifica di un obiettivo.
 */

'use client';

import { useState } from 'react';

/**
 * @param {object}   props
 * @param {object}   [props.initial]  - Obiettivo da modificare; assente in creazione.
 * @param {string}   props.minMonth   - Primo mese selezionabile come scadenza ('YYYY-MM').
 * @param {Function} props.onSaved    - Chiamata dopo il salvataggio.
 * @param {Function} props.onClose
 */
export default function GoalFormModal({ initial = null, minMonth, onSaved, onClose }) {
  const [form, setForm] = useState({
    name:          initial?.name ?? '',
    targetAmount:  initial?.targetAmount?.toString() ?? '',
    deadline:      initial?.deadline ?? '',
    initialAmount: initial?.initialAmount ? initial.initialAmount.toString() : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(initial ? `/api/obiettivi/${initial.id}` : '/api/obiettivi', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          targetAmount: parseFloat(form.targetAmount),
          deadline: form.deadline,
          initialAmount: form.initialAmount ? parseFloat(form.initialAmount) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore durante il salvataggio');
        setSaving(false);
        return;
      }
      onSaved(data);
    } catch {
      setError('Errore di rete. Riprova.');
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <form className="modal-box w-11/12 max-w-md" onSubmit={handleSubmit}>
        <h3 className="font-bold text-lg mb-1">{initial ? 'Modifica obiettivo' : 'Nuovo obiettivo'}</h3>
        <p className="text-xs text-base-content/50 mb-4">
          Qualcosa da acquistare entro una data: un viaggio, un&apos;auto, la casa. Si finanzia con il
          risparmio dei mesi chiusi, secondo la percentuale che sceglierai.
        </p>

        {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}

        <div className="flex flex-col gap-3">
          <label className="form-control">
            <div className="label py-1"><span className="label-text font-medium">Cosa vuoi acquistare *</span></div>
            <input
              type="text" className="input input-bordered w-full" maxLength={100} required autoFocus
              placeholder="Es. Viaggio in Giappone"
              value={form.name} onChange={(e) => set('name', e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <div className="label py-1"><span className="label-text font-medium">Importo (€) *</span></div>
              <input
                type="number" step="0.01" min="1" className="input input-bordered w-full" required
                value={form.targetAmount} onChange={(e) => set('targetAmount', e.target.value)}
              />
            </label>
            <label className="form-control">
              <div className="label py-1"><span className="label-text font-medium">Entro *</span></div>
              <input
                type="month" className="input input-bordered w-full" required
                // Dove type="month" non è supportato diventa un campo di testo: serve il formato.
                placeholder="AAAA-MM" pattern="\d{4}-\d{2}"
                // Una scadenza già passata si può tenere; una nuova deve essere futura.
                min={initial && form.deadline === initial.deadline ? undefined : minMonth}
                value={form.deadline} onChange={(e) => set('deadline', e.target.value)}
              />
            </label>
          </div>

          <label className="form-control">
            <div className="label py-1">
              <span className="label-text">Già messo da parte (€) <span className="text-base-content/40">(opzionale)</span></span>
            </div>
            <input
              type="number" step="0.01" min="0" className="input input-bordered w-full" placeholder="0"
              value={form.initialAmount} onChange={(e) => set('initialAmount', e.target.value)}
            />
            {/* Fuori da .label: DaisyUI 5 la rende nowrap e la frase allargherebbe la modale. */}
            <p className="text-xs text-base-content/50 mt-1">
              Soldi che hai già accantonato per questo obiettivo prima di oggi.
            </p>
          </label>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : initial ? 'Salva' : 'Crea obiettivo'}
          </button>
        </div>
      </form>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
