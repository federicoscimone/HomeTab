'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { PAYMENT_METHODS } from '@/lib/utils/payments';

/** Campi mappabili; le etichette stanno in messages/*.json, sotto templates.fields. */
const FIELDS = ['date', 'amount', 'amountDebit', 'amountCredit', 'description', 'payee', 'place', 'notes'];

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'D/M/YYYY'];

const EMPTY_FORM = {
  name: '', fileType: 'xlsx', skipRows: 0, delimiter: ';', dateFormat: 'DD/MM/YYYY',
  columnMapping: { date:'', amount:'', description:'', payee:'', place:'', notes:'' },
  amountDebit: '', amountCredit: '', amountSign: 'absolute',
  defaultPaymentMethod: '',
  payeeMethodKeywords: [],
};

export default function TemplateImportPage() {
  const t = useTranslations('templates');
  const tCommon = useTranslations('common');
  const tPay = useTranslations('payments');
  const dateFormatLabel = (f) => (t.has(`dateFormats.${f}`) ? t(`dateFormats.${f}`) : f);
  const { data, loading, reload: load } = useApiData('/api/impostazioni/template-import', 'impostazioni/template-import');
  const templates = data ?? [];
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError('');
    setModal({ mode: 'add' });
  };

  const openEdit = (tpl) => {
    setForm({
      name: tpl.name, fileType: tpl.fileType, skipRows: tpl.skipRows,
      delimiter: tpl.delimiter, dateFormat: tpl.dateFormat,
      columnMapping: { ...EMPTY_FORM.columnMapping, ...tpl.columnMapping },
      amountDebit: tpl.amountDebit || '', amountCredit: tpl.amountCredit || '',
      amountSign: tpl.amountSign || 'absolute',
      defaultPaymentMethod: tpl.defaultPaymentMethod || '',
      payeeMethodKeywords: tpl.payeeMethodKeywords ? [...tpl.payeeMethodKeywords] : [],
    });
    setError('');
    setModal({ mode: 'edit', id: tpl._id });
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
    if (!form.name.trim()) { setError(t('nameRequired')); return; }
    setSaving(true); setError('');
    const payload = { ...form, skipRows: parseInt(form.skipRows) || 0 };
    const res = await fetch(
      modal.mode === 'edit' ? `/api/impostazioni/template-import/${modal.id}` : '/api/impostazioni/template-import',
      { method: modal.mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) }
    );
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || t('saveFailed')); return; }
    setModal(null);
    load();
  };

  const handleDelete = async () => {
    // Prima l'esito non veniva guardato: un errore chiudeva la modale come se fosse andata bene.
    setDeleting(true);
    setDeleteError('');
    const res = await fetch(`/api/impostazioni/template-import/${deleteTarget._id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) { setDeleteError(data.error || t('deleteFailed')); return; }
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-base-content/50 mt-1">{t('subtitle')}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>{'+'} {t('new')}</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="loading loading-spinner loading-md text-primary" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-base-content/40">
          <p className="text-3xl mb-2">{'📋'}</p>
          <p>{t('empty')}</p>
          <p className="text-xs mt-1">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map(tpl => {
            const column = (key) => (key === 'amountDebit' || key === 'amountCredit' ? tpl[key] : tpl.columnMapping?.[key]);
            return (
            <div key={tpl._id} className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{tpl.name}</h3>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="badge badge-ghost badge-sm">{tpl.fileType.toUpperCase()}</span>
                      <span className="badge badge-ghost badge-sm">{t('skipRows', { count: tpl.skipRows })}</span>
                      <span className="badge badge-ghost badge-sm">{t('dateBadge', { format: dateFormatLabel(tpl.dateFormat) })}</span>
                      {tpl.fileType === 'csv' && <span className="badge badge-ghost badge-sm">{t('separatorBadge', { delimiter: tpl.delimiter })}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-xs" onClick={() => openEdit(tpl)}>{tCommon('edit')}</button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => { setDeleteError(''); setDeleteTarget(tpl); }}>{tCommon('delete')}</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-1">
                  {FIELDS.filter((key) => column(key)).map((key) => (
                    <div key={key} className="text-xs flex gap-1">
                      <span className="font-mono bg-base-200 px-1 rounded">{column(key)}</span>
                      <span className="text-base-content/60">{`→ ${t(`fields.${key}`)}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Modal form */}
      {modal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">
              {modal.mode === 'add' ? t('addTitle') : t('editTitle')}
            </h3>
            {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              <label className="form-control">
                <div className="label"><span className="label-text font-medium">{t('name')}</span></div>
                <input type="text" className="input input-bordered input-sm" placeholder={t('namePlaceholder')}
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <div className="label"><span className="label-text">{t('fileType')}</span></div>
                  <select className="select select-bordered select-sm" value={form.fileType}
                    onChange={e => setForm({ ...form, fileType: e.target.value })}>
                    {['xlsx', 'csv', 'paste'].map((v) => <option key={v} value={v}>{t(`fileTypes.${v}`)}</option>)}
                  </select>
                </label>

                <label className="form-control">
                  <div className="label"><span className="label-text">{t('skipRowsLabel')}</span></div>
                  <input type="number" min="0" className="input input-bordered input-sm"
                    value={form.skipRows} onChange={e => setForm({ ...form, skipRows: e.target.value })} />
                </label>

                <label className="form-control">
                  <div className="label"><span className="label-text">{t('dateFormat')}</span></div>
                  <select className="select select-bordered select-sm" value={form.dateFormat}
                    onChange={e => setForm({ ...form, dateFormat: e.target.value })}>
                    {DATE_FORMATS.map((f) => <option key={f} value={f}>{dateFormatLabel(f)}</option>)}
                  </select>
                </label>

                {form.fileType === 'csv' && (
                  <label className="form-control">
                    <div className="label"><span className="label-text">{t('separator')}</span></div>
                    <select className="select select-bordered select-sm" value={form.delimiter}
                      onChange={e => setForm({ ...form, delimiter: e.target.value })}>
                      <option value=";">{t('separators.semicolon')}</option>
                      <option value=",">{t('separators.comma')}</option>
                      <option value="\t">{t('separators.tab')}</option>
                    </select>
                  </label>
                )}
              </div>

              <div className="divider text-xs my-1">{t('mappingDivider')}</div>

              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map(key => (
                  <label key={key} className="form-control">
                    <div className="label py-0"><span className="label-text text-xs">{t(`fields.${key}`)}</span></div>
                    <input type="text" className="input input-bordered input-xs" placeholder={t('columnPlaceholder')}
                      value={key === 'amountDebit' ? form.amountDebit :
                             key === 'amountCredit' ? form.amountCredit :
                             form.columnMapping[key] || ''}
                      onChange={e => {
                        if (key === 'amountDebit') setForm({ ...form, amountDebit: e.target.value });
                        else if (key === 'amountCredit') setForm({ ...form, amountCredit: e.target.value });
                        else setMapping(key, e.target.value);
                      }} />
                  </label>
                ))}
              </div>

              {/* Segno importo — solo per colonna singola */}
              {(form.columnMapping.amount && !form.amountDebit && !form.amountCredit) && (
                <label className="form-control col-span-2">
                  <div className="label py-0"><span className="label-text text-xs">{t('amountSign')}</span></div>
                  <select className="select select-bordered select-xs" value={form.amountSign}
                    onChange={e => setForm({ ...form, amountSign: e.target.value })}>
                    {['absolute', 'negative_is_income', 'negative_is_expense'].map((s) => (
                      <option key={s} value={s}>{t(`signs.${s}`)}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="alert alert-info text-xs py-2 col-span-2">
                <span>{t('amountHint')}</span>
              </div>

              <div className="divider text-xs my-1">{t('methodDivider')}</div>

              {/* Metodo fisso */}
              <label className="form-control col-span-2">
                <div className="label py-0">
                  <span className="label-text text-xs font-medium">{t('fixedMethod')}</span>
                  <span className="label-text-alt text-xs text-base-content/50">{t('fixedMethodHint')}</span>
                </div>
                <select className="select select-bordered select-xs" value={form.defaultPaymentMethod}
                  onChange={e => setForm({ ...form, defaultPaymentMethod: e.target.value })}>
                  <option value="">{t('noFixedMethod')}</option>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{tPay(m.value)}</option>
                  ))}
                </select>
              </label>

              {/* Keyword → metodo */}
              {!form.defaultPaymentMethod && (
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="label-text text-xs font-medium">{t('methodKeywords')}</p>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={addKeyword}>{'+'} {t('add')}</button>
                  </div>
                  {form.payeeMethodKeywords.length === 0 ? (
                    <p className="text-xs text-base-content/40 italic">{t('noMethodKeywords')}</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {form.payeeMethodKeywords.map((kw, idx) => (
                        <div key={idx} className="flex gap-1 items-center">
                          <input
                            type="text"
                            className="input input-bordered input-xs flex-1"
                            placeholder={t('methodKeywordPlaceholder')}
                            value={kw.keyword}
                            onChange={e => updateKeyword(idx, 'keyword', e.target.value)}
                          />
                          <select
                            className="select select-bordered select-xs w-40"
                            value={kw.method}
                            onChange={e => updateKeyword(idx, 'method', e.target.value)}
                          >
                            {PAYMENT_METHODS.map(m => (
                              <option key={m.value} value={m.value}>{tPay(m.value)}</option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-ghost btn-xs text-error px-1"
                            onClick={() => removeKeyword(idx)} aria-label={t('removeKeyword')}>{'✕'}</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-base-content/40 mt-1">{t('methodKeywordsHint')}</p>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>{tCommon('cancel')}</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving && <span className="loading loading-spinner loading-xs" />}
                {saving ? tCommon('saving') : tCommon('save')}
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
            <h3 className="font-bold text-lg">{t('deleteTitle')}</h3>
            <p className="py-3 text-sm">{t.rich('deleteText', { name: deleteTarget.name, b: (chunks) => <strong>{chunks}</strong> })}</p>
            {deleteError && <div className="alert alert-error text-sm py-2"><span>{deleteError}</span></div>}
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>{tCommon('cancel')}</button>
              <button className="btn btn-error btn-sm" onClick={handleDelete} disabled={deleting}>
                {deleting && <span className="loading loading-spinner loading-xs" />}
                {tCommon('delete')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeleteTarget(null)} />
        </div>
      )}
    </div>
  );
}
