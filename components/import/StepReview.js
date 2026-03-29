'use client';

import { useState } from 'react';
import { PAYMENT_METHODS } from '@/lib/utils/payments';
import PaymentBadge from '@/components/spese/PaymentBadge';

function formatAmount(n) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function StepReview({ rows: initialRows, categories, onSaved, onBack }) {
  const [rows, setRows] = useState(initialRows);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [editingRow, setEditingRow] = useState(null); // indice riga in modifica

  const level1 = categories.filter(c => c.level === 1);
  const level2of = (catId) => categories.filter(c => c.level === 2 && c.parentId?.toString() === catId);

  const selected = rows.filter(r => r.selected);
  const autocat  = rows.filter(r => r._autocat).length;

  const toggleAll = (val) => setRows(rs => rs.map(r => ({ ...r, selected: val })));
  const toggleRow = (i) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));

  const updateRow = (i, field, value) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleSave = async () => {
    setSaving(true);
    const payload = selected.map(r => ({
      amount: r.amount, paymentMethod: r.paymentMethod,
      date: r.date, time: r.time || null,
      description: r.description, place: r.place,
      payee: r.payee, notes: r.notes,
      categoryId: r.categoryId || null,
      subCategory1Id: r.subCategory1Id || null,
      subCategory2Id: null,
    }));

    const res = await fetch('/api/import/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: payload, skipDuplicates }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) setResult(data);
  };

  if (result) {
    return (
      <div className="card bg-base-100 border border-base-200 shadow-sm max-w-md mx-auto">
        <div className="card-body gap-4 text-center">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold">Import completato</h2>
          <div className="stats stats-vertical shadow-sm">
            <div className="stat py-2">
              <div className="stat-title text-xs">Salvate</div>
              <div className="stat-value text-success text-2xl">{result.saved}</div>
            </div>
            {result.duplicates > 0 && (
              <div className="stat py-2">
                <div className="stat-title text-xs">Duplicate saltate</div>
                <div className="stat-value text-warning text-2xl">{result.duplicates}</div>
              </div>
            )}
            {result.errors > 0 && (
              <div className="stat py-2">
                <div className="stat-title text-xs">Errori</div>
                <div className="stat-value text-error text-2xl">{result.errors}</div>
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={onSaved}>Vai alle spese</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Riepilogo */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Revisione dati</h2>
          <p className="text-sm text-base-content/50">
            {rows.length} righe analizzate · {autocat} auto-categorizzate ·{' '}
            <span className="text-primary font-medium">{selected.length} selezionate</span>
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm"
              checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} />
            Salta duplicati
          </label>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Indietro</button>
          <button
            className={`btn btn-primary btn-sm ${saving ? 'loading' : ''}`}
            onClick={handleSave} disabled={saving || selected.length === 0}
          >
            {saving ? 'Salvataggio…' : `Importa ${selected.length} spese`}
          </button>
        </div>
      </div>

      {/* Seleziona tutto / nessuno */}
      <div className="flex gap-2 text-xs">
        <button className="btn btn-ghost btn-xs" onClick={() => toggleAll(true)}>Seleziona tutto</button>
        <button className="btn btn-ghost btn-xs" onClick={() => toggleAll(false)}>Deseleziona tutto</button>
      </div>

      {/* Tabella */}
      <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-xs">
            <thead>
              <tr className="bg-base-200">
                <th className="w-8"></th>
                <th>Data</th>
                <th>Esercente / Causale</th>
                <th>Tipo</th>
                <th>Metodo</th>
                <th>Categoria</th>
                <th className="text-right">Importo</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                editingRow === i
                  ? <EditRow key={i} row={row} index={i} categories={categories}
                      level1={level1} level2of={level2of}
                      onSave={(field, value) => { updateRow(i, field, value); }}
                      onClose={() => setEditingRow(null)} />
                  : (
                    <tr key={i} className={`hover ${!row.selected ? 'opacity-40' : ''}`}>
                      <td>
                        <input type="checkbox" className="checkbox checkbox-xs"
                          checked={row.selected} onChange={() => toggleRow(i)} />
                      </td>
                      <td className="whitespace-nowrap">{row.date}</td>
                      <td>
                        <p className="font-medium">{row.payee || row.description || '—'}</p>
                        {row.payee && row.description && (
                          <p className="text-xs text-base-content/50">{row.description}</p>
                        )}
                      </td>
                      <td>
                        <select
                          className={`select select-xs select-bordered ${row.type === 'income' ? 'border-success text-success' : 'border-error text-error'}`}
                          value={row.type || 'expense'}
                          onChange={e => updateRow(i, 'type', e.target.value)}
                        >
                          <option value="expense">↑ Uscita</option>
                          <option value="income">↓ Entrata</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="select select-xs select-bordered min-w-[130px]"
                          value={row.paymentMethod}
                          onChange={e => updateRow(i, 'paymentMethod', e.target.value)}
                        >
                          {PAYMENT_METHODS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <select
                            className={`select select-xs select-bordered min-w-[130px] ${row._autocat && row.categoryId ? 'border-success' : ''}`}
                            value={row.categoryId || ''}
                            onChange={e => updateRow(i, 'categoryId', e.target.value || null)}
                          >
                            <option value="">— Nessuna —</option>
                            {level1.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                          </select>
                          {row.categoryId && level2of(row.categoryId).length > 0 && (
                            <select
                              className="select select-xs select-bordered min-w-[130px]"
                              value={row.subCategory1Id || ''}
                              onChange={e => updateRow(i, 'subCategory1Id', e.target.value || null)}
                            >
                              <option value="">— Sub —</option>
                              {level2of(row.categoryId).map(c => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                              ))}
                            </select>
                          )}
                          {row._autocat && row.categoryId && (
                            <span className="badge badge-success badge-xs">auto</span>
                          )}
                        </div>
                      </td>
                      <td className={`text-right font-semibold whitespace-nowrap ${row.type === 'income' ? 'text-success' : ''}`}>
                        {row.type === 'income' ? '+' : ''}{formatAmount(row.amount)}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs" title="Modifica dettagli"
                          onClick={() => setEditingRow(i)}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Riga in modalità modifica inline
function EditRow({ row, index, level1, level2of, onSave, onClose }) {
  const [local, setLocal] = useState({ ...row });

  const commit = (field, value) => {
    setLocal(l => ({ ...l, [field]: value }));
    onSave(field, value);
  };

  return (
    <tr className="bg-base-200">
      <td colSpan={7} className="py-3 px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">Data</span></div>
            <input type="date" className="input input-bordered input-xs"
              value={local.date} onChange={e => commit('date', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">Importo (€)</span></div>
            <input type="number" step="0.01" className="input input-bordered input-xs"
              value={local.amount} onChange={e => commit('amount', parseFloat(e.target.value))} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">Esercente</span></div>
            <input type="text" className="input input-bordered input-xs"
              value={local.payee} onChange={e => commit('payee', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">Causale</span></div>
            <input type="text" className="input input-bordered input-xs"
              value={local.description} onChange={e => commit('description', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">Luogo</span></div>
            <input type="text" className="input input-bordered input-xs"
              value={local.place} onChange={e => commit('place', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-0"><span className="label-text text-xs">Note</span></div>
            <input type="text" className="input input-bordered input-xs"
              value={local.notes} onChange={e => commit('notes', e.target.value)} />
          </label>
        </div>
        <div className="mt-2 flex justify-end">
          <button className="btn btn-primary btn-xs" onClick={onClose}>Chiudi</button>
        </div>
      </td>
    </tr>
  );
}
