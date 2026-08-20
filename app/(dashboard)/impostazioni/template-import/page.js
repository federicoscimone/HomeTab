'use client';

import { useState, useEffect } from 'react';

const FIELDS = [
  { key: 'date',        label: 'Data' },
  { key: 'amount',      label: 'Importo' },
  { key: 'amountDebit', label: 'Importo Uscite (colonna separata)' },
  { key: 'amountCredit',label: 'Importo Entrate (colonna separata)' },
  { key: 'description', label: 'Causale / Descrizione' },
  { key: 'payee',       label: 'Esercente' },
  { key: 'place',       label: 'Luogo' },
  { key: 'notes',       label: 'Note' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash',          label: 'Contanti' },
  { value: 'credit_card',   label: 'Carta di Credito' },
  { value: 'debit_card',    label: 'Carta di Debito' },
  { value: 'bank_transfer', label: 'Bonifico' },
  { value: 'direct_debit',  label: 'Addebito Diretto' },
  { value: 'paypal',        label: 'PayPal' },
  { value: 'satispay',      label: 'Satispay' },
  { value: 'meal_ticket',   label: 'Ticket Pasto' },
  { value: 'gift_voucher',  label: 'Buono Acquisto' },
  { value: 'fuel_voucher',  label: 'Buono Carburante' },
  { value: 'other_voucher', label: 'Altro Voucher' },
  { value: 'other',         label: 'Altro' },
];

const DATE_FORMAT_LABEL = {
  'DD/MM/YYYY':  'GG/MM/AAAA',
  'MM/DD/YYYY':  'MM/GG/AAAA',
  'YYYY-MM-DD':  'AAAA-MM-GG',
  'DD-MM-YYYY':  'GG-MM-AAAA',
  'D/M/YYYY':    'G/M/AAAA',
};

const EMPTY_FORM = {
  name: '', fileType: 'xlsx', skipRows: 0, delimiter: ';', dateFormat: 'DD/MM/YYYY',
  columnMapping: { date:'', amount:'', description:'', payee:'', place:'', notes:'' },
  amountDebit: '', amountCredit: '', amountSign: 'absolute',
  defaultPaymentMethod: '',
  payeeMethodKeywords: [],
};

export default function TemplateImportPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/impostazioni/template-import');
    setTemplates(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError('');
    setModal({ mode: 'add' });
  };

  const openEdit = (t) => {
    setForm({
      name: t.name, fileType: t.fileType, skipRows: t.skipRows,
      delimiter: t.delimiter, dateFormat: t.dateFormat,
      columnMapping: { ...EMPTY_FORM.columnMapping, ...t.columnMapping },
      amountDebit: t.amountDebit || '', amountCredit: t.amountCredit || '',
      amountSign: t.amountSign || 'absolute',
      defaultPaymentMethod: t.defaultPaymentMethod || '',
      payeeMethodKeywords: t.payeeMethodKeywords ? [...t.payeeMethodKeywords] : [],
    });
    setError('');
    setModal({ mode: 'edit', id: t._id });
  };

  const addKeyword = () =>
    setForm(f => ({ ...f, payeeMethodKeywords: [...f.payeeMethodKeywords, { keyword: '', method: 'credit_card' }] }));

  const updateKeyword = (idx, field, value) =>
    setForm(f => ({
      ...f,
      payeeMethodKeywords: f.payeeMethodKeywords.map((k, i) => i === idx ? { ...k, [field]: value } : k),
    }));

  const removeKeyword = (idx) =>
    setForm(f => ({ ...f, payeeMethodKeywords: f.payeeMethodKeywords.filter((_, i) => i !== idx) }));

  const setMapping = (key, value) =>
    setForm(f => ({ ...f, columnMapping: { ...f.columnMapping, [key]: value } }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Il nome è obbligatorio'); return; }
    setSaving(true); setError('');
    const payload = { ...form, skipRows: parseInt(form.skipRows) || 0 };
    const res = await fetch(
      modal.mode === 'edit' ? `/api/impostazioni/template-import/${modal.id}` : '/api/impostazioni/template-import',
      { method: modal.mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Errore'); return; }
    setModal(null);
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/impostazioni/template-import/${deleteTarget._id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Template Import</h1>
          <p className="text-sm text-base-content/50 mt-1">Configura la mappatura colonne per ogni formato bancario</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Nuovo template</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="loading loading-spinner loading-md text-primary" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-base-content/40">
          <p className="text-3xl mb-2">📋</p>
          <p>Nessun template configurato</p>
          <p className="text-xs mt-1">Crea un template per ogni estratto conto o carta che usi</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map(t => (
            <div key={t._id} className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="badge badge-ghost badge-sm">{t.fileType.toUpperCase()}</span>
                      <span className="badge badge-ghost badge-sm">Salta {t.skipRows} righe</span>
                      <span className="badge badge-ghost badge-sm">Data: {DATE_FORMAT_LABEL[t.dateFormat] || t.dateFormat}</span>
                      {t.fileType === 'csv' && <span className="badge badge-ghost badge-sm">Sep: "{t.delimiter}"</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-xs" onClick={() => openEdit(t)}>Modifica</button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteTarget(t)}>Elimina</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-1">
                  {FIELDS.filter(f => {
                    const v = f.key === 'amountDebit' ? t.amountDebit :
                              f.key === 'amountCredit' ? t.amountCredit :
                              t.columnMapping?.[f.key];
                    return v;
                  }).map(f => {
                    const v = f.key === 'amountDebit' ? t.amountDebit :
                              f.key === 'amountCredit' ? t.amountCredit :
                              t.columnMapping?.[f.key];
                    return (
                      <div key={f.key} className="text-xs flex gap-1">
                        <span className="font-mono bg-base-200 px-1 rounded">{v}</span>
                        <span className="text-base-content/60">→ {f.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal form */}
      {modal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">
              {modal.mode === 'add' ? 'Nuovo template' : 'Modifica template'}
            </h3>
            {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              <label className="form-control">
                <div className="label"><span className="label-text font-medium">Nome template *</span></div>
                <input type="text" className="input input-bordered input-sm" placeholder="Es. Intesa Sanpaolo - Carta"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <div className="label"><span className="label-text">Tipo file</span></div>
                  <select className="select select-bordered select-sm" value={form.fileType}
                    onChange={e => setForm({ ...form, fileType: e.target.value })}>
                    <option value="xlsx">Excel (.xlsx)</option>
                    <option value="csv">CSV</option>
                    <option value="paste">Copia-incolla</option>
                  </select>
                </label>

                <label className="form-control">
                  <div className="label"><span className="label-text">Righe da saltare</span></div>
                  <input type="number" min="0" className="input input-bordered input-sm"
                    value={form.skipRows} onChange={e => setForm({ ...form, skipRows: e.target.value })} />
                </label>

                <label className="form-control">
                  <div className="label"><span className="label-text">Formato data</span></div>
                  <select className="select select-bordered select-sm" value={form.dateFormat}
                    onChange={e => setForm({ ...form, dateFormat: e.target.value })}>
                    <option value="DD/MM/YYYY">GG/MM/AAAA</option>
                    <option value="MM/DD/YYYY">MM/GG/AAAA</option>
                    <option value="YYYY-MM-DD">AAAA-MM-GG</option>
                    <option value="DD-MM-YYYY">GG-MM-AAAA</option>
                    <option value="D/M/YYYY">G/M/AAAA</option>
                  </select>
                </label>

                {form.fileType === 'csv' && (
                  <label className="form-control">
                    <div className="label"><span className="label-text">Separatore CSV</span></div>
                    <select className="select select-bordered select-sm" value={form.delimiter}
                      onChange={e => setForm({ ...form, delimiter: e.target.value })}>
                      <option value=";">Punto e virgola (;)</option>
                      <option value=",">Virgola (,)</option>
                      <option value="\t">Tab</option>
                    </select>
                  </label>
                )}
              </div>

              <div className="divider text-xs my-1">Mappatura colonne (lettera A, B, C… o numero 0, 1, 2…)</div>

              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map(f => (
                  <label key={f.key} className="form-control">
                    <div className="label py-0"><span className="label-text text-xs">{f.label}</span></div>
                    <input type="text" className="input input-bordered input-xs" placeholder="es. A o 0"
                      value={f.key === 'amountDebit' ? form.amountDebit :
                             f.key === 'amountCredit' ? form.amountCredit :
                             form.columnMapping[f.key] || ''}
                      onChange={e => {
                        if (f.key === 'amountDebit') setForm({ ...form, amountDebit: e.target.value });
                        else if (f.key === 'amountCredit') setForm({ ...form, amountCredit: e.target.value });
                        else setMapping(f.key, e.target.value);
                      }} />
                  </label>
                ))}
              </div>

              {/* Segno importo — solo per colonna singola */}
              {(form.columnMapping.amount && !form.amountDebit && !form.amountCredit) && (
                <label className="form-control col-span-2">
                  <div className="label py-0"><span className="label-text text-xs">Interpretazione segno importo</span></div>
                  <select className="select select-bordered select-xs" value={form.amountSign}
                    onChange={e => setForm({ ...form, amountSign: e.target.value })}>
                    <option value="absolute">Sempre positivo (uscite, ignora entrate)</option>
                    <option value="negative_is_income">Negativo = Entrata, Positivo = Uscita</option>
                    <option value="negative_is_expense">Negativo = Uscita, Positivo = Entrata</option>
                  </select>
                </label>
              )}

              <div className="alert alert-info text-xs py-2 col-span-2">
                <span>Se la banca usa colonne separate per Uscite/Entrate, compila entrambe e lascia vuoto "Importo". Altrimenti usa solo "Importo" e configura il segno.</span>
              </div>

              <div className="divider text-xs my-1">Metodo di pagamento</div>

              {/* Metodo fisso */}
              <label className="form-control col-span-2">
                <div className="label py-0">
                  <span className="label-text text-xs font-medium">Metodo fisso per tutto il file</span>
                  <span className="label-text-alt text-xs text-base-content/50">es. carta di credito, bonifico</span>
                </div>
                <select className="select select-bordered select-xs" value={form.defaultPaymentMethod}
                  onChange={e => setForm({ ...form, defaultPaymentMethod: e.target.value })}>
                  <option value="">— Nessuno (usa rilevamento automatico) —</option>
                  {PAYMENT_METHOD_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              {/* Keyword → metodo */}
              {!form.defaultPaymentMethod && (
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="label-text text-xs font-medium">
                      Keyword per rilevamento metodo automatico
                    </p>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={addKeyword}>+ Aggiungi</button>
                  </div>
                  {form.payeeMethodKeywords.length === 0 ? (
                    <p className="text-xs text-base-content/40 italic">
                      Nessuna keyword — il metodo andrà selezionato manualmente in revisione.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {form.payeeMethodKeywords.map((kw, idx) => (
                        <div key={idx} className="flex gap-1 items-center">
                          <input
                            type="text"
                            className="input input-bordered input-xs flex-1"
                            placeholder="es. VISA, BANCOMAT, SATISPAY…"
                            value={kw.keyword}
                            onChange={e => updateKeyword(idx, 'keyword', e.target.value)}
                          />
                          <select
                            className="select select-bordered select-xs w-40"
                            value={kw.method}
                            onChange={e => updateKeyword(idx, 'method', e.target.value)}
                          >
                            {PAYMENT_METHOD_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-ghost btn-xs text-error px-1"
                            onClick={() => removeKeyword(idx)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-base-content/40 mt-1">
                    La prima keyword trovata nel testo della causale/esercente vince. Le righe senza match vengono evidenziate in revisione.
                  </p>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Annulla</button>
              <button className={`btn btn-primary btn-sm ${saving ? 'loading' : ''}`} onClick={handleSave} disabled={saving}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setModal(null)} />
        </div>
      )}

      {/* Modal elimina */}
      {deleteTarget && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Elimina template</h3>
            <p className="py-3 text-sm">Elimina il template <strong>{deleteTarget.name}</strong>?</p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>Annulla</button>
              <button className={`btn btn-error btn-sm ${deleting ? 'loading' : ''}`} onClick={handleDelete} disabled={deleting}>Elimina</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeleteTarget(null)} />
        </div>
      )}
    </div>
  );
}
