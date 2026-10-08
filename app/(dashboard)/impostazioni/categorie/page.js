'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';

const COLORS = ['#3b82f6','#22c55e','#f97316','#ef4444','#ec4899','#8b5cf6',
                 '#06b6d4','#64748b','#f59e0b','#10b981','#84cc16','#a855f7','#0ea5e9','#94a3b8'];

const EMPTY = { name: '', color: '#6366f1', level: 1, parentId: null };

export default function CategoriesPage() {
  const t = useTranslations('categoriesSettings');
  const tCommon = useTranslations('common');
  const { data, loading, reload: load } = useApiData('/api/categorie', 'impostazioni/categorie');
  const categories = data ?? [];
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [expanded, setExpanded] = useState({});

  const level1 = categories.filter(c => c.level === 1).sort((a,b) => (a.order - b.order) || a.name.localeCompare(b.name));
  const childrenOf = (id) => categories.filter(c => c.parentId?.toString() === id?.toString());

  const openAdd = (level, parentId = null) => {
    setForm({ ...EMPTY, level, parentId });
    setError('');
    setModal({ mode: 'add' });
  };

  const openEdit = (cat) => {
    setForm({ name: cat.name, color: cat.color || '#6366f1', level: cat.level, parentId: cat.parentId });
    setError('');
    setModal({ mode: 'edit', id: cat._id });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('nameRequired')); return; }
    setSaving(true); setError('');
    const res = await fetch(
      modal.mode === 'edit' ? `/api/categorie/${modal.id}` : '/api/categorie',
      { method: modal.mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form) }
    );
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || t('saveFailed')); return; }
    setModal(null);
    load();
  };

  const handleDelete = async () => {
    setDeleting(true); setDeleteError('');
    const res = await fetch(`/api/categorie/${deleteTarget._id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) { setDeleteError(data.error || t('deleteFailed')); return; }
    setDeleteTarget(null);
    load();
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button className="btn btn-primary btn-sm" onClick={() => openAdd(1)}>{'+'} {t('new')}</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="loading loading-spinner loading-md text-primary" /></div>
      ) : (
        <div className="flex flex-col gap-2">
          {level1.map(cat => (
            <div key={cat._id} className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3">
                <button className="btn btn-ghost btn-xs p-0" onClick={() => toggle(cat._id)} aria-label={t('expand')} aria-expanded={!!expanded[cat._id]}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${expanded[cat._id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="font-semibold flex-1">{cat.name}</span>
                <span className="badge badge-ghost badge-sm">{t('subCount', { count: childrenOf(cat._id).length })}</span>
                <button className="btn btn-ghost btn-xs" onClick={() => openEdit(cat)}>{tCommon('edit')}</button>
                <button className="btn btn-ghost btn-xs text-error" onClick={() => { setDeleteError(''); setDeleteTarget(cat); }}>{tCommon('delete')}</button>
              </div>

              {expanded[cat._id] && (
                <div className="border-t border-base-200 px-4 pb-3">
                  <div className="ml-6 mt-2 flex flex-col gap-1">
                    {childrenOf(cat._id).map(sub => (
                      <div key={sub._id}>
                        <div className="flex items-center gap-3 py-1.5">
                          <button className="btn btn-ghost btn-xs p-0" onClick={() => toggle(sub._id)} aria-label={t('expand')} aria-expanded={!!expanded[sub._id]}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${expanded[sub._id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <span className="text-sm flex-1">{sub.name}</span>
                          <span className="badge badge-ghost badge-xs">{t('subCount', { count: childrenOf(sub._id).length })}</span>
                          <button className="btn btn-ghost btn-xs text-xs" onClick={() => openEdit(sub)}>{tCommon('edit')}</button>
                          <button className="btn btn-ghost btn-xs text-xs text-error" onClick={() => { setDeleteError(''); setDeleteTarget(sub); }}>{tCommon('delete')}</button>
                        </div>
                        {expanded[sub._id] && (
                          <div className="ml-6 flex flex-col gap-1 mt-1 mb-1">
                            {childrenOf(sub._id).map(sub2 => (
                              <div key={sub2._id} className="flex items-center gap-3 py-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-base-300 flex-shrink-0 ml-1" />
                                <span className="text-sm flex-1 text-base-content/80">{sub2.name}</span>
                                <button className="btn btn-ghost btn-xs text-xs" onClick={() => openEdit(sub2)}>{tCommon('edit')}</button>
                                <button className="btn btn-ghost btn-xs text-xs text-error" onClick={() => { setDeleteError(''); setDeleteTarget(sub2); }}>{tCommon('delete')}</button>
                              </div>
                            ))}
                            <button className="btn btn-ghost btn-xs text-xs w-fit ml-2 mt-1" onClick={() => openAdd(3, sub._id)}>
                              {'+'} {t('addSub2')}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-xs text-xs w-fit mt-1" onClick={() => openAdd(2, cat._id)}>
                      {'+'} {t('addSub')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal aggiungi/modifica */}
      {modal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {t(`${modal.mode === 'add' ? 'addTitle' : 'editTitle'}${form.level}`)}
            </h3>
            {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}
            <div className="flex flex-col gap-3">
              <label className="form-control">
                <div className="label"><span className="label-text">{t('name')}</span></div>
                <input type="text" className="input input-bordered" placeholder={t('namePlaceholder')}
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
              </label>
              {form.level === 1 && (
                <div>
                  <div className="label"><span className="label-text">{t('color')}</span></div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COLORS.map(c => (
                      <button key={c} type="button"
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-base-content scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} onClick={() => setForm({ ...form, color: c })} aria-label={c} />
                    ))}
                    <input type="color" className="w-7 h-7 rounded cursor-pointer border border-base-300"
                      aria-label={t('customColor')} value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                  </div>
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
            <p className="py-3 text-sm">
              {t.rich('deleteText', { name: deleteTarget.name, b: (chunks) => <strong>{chunks}</strong> })}
              {childrenOf(deleteTarget._id).length > 0 && (
                <span className="block mt-1 text-warning text-xs">
                  {t('deleteChildren', { count: childrenOf(deleteTarget._id).length })}
                </span>
              )}
            </p>
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
