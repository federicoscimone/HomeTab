'use client';

import { useState } from 'react';
import { useApiData } from '@/lib/hooks/useApiData';

const EMPTY_FORM = { keyword: '', categoryId: '', subCategory1Id: '', priority: 10, caseSensitive: false };

export default function KeywordMappingPage() {
  const mappingsApi = useApiData('/api/impostazioni/keyword-mapping', 'impostazioni/keyword-mapping');
  const categoriesApi = useApiData('/api/categorie', 'impostazioni/keyword-mapping');
  const mappings = mappingsApi.data ?? [];
  const categories = categoriesApi.data ?? [];
  const loading = mappingsApi.loading || categoriesApi.loading;
  // Da questa pagina cambiano solo le regole: le categorie non serve ricaricarle.
  const load = mappingsApi.reload;
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const level1 = categories.filter(c => c.level === 1);
  const level2ofSelected = categories.filter(c => c.level === 2 && c.parentId?.toString() === form.categoryId);

  const openAdd = () => { setForm(EMPTY_FORM); setError(''); setModal({ mode: 'add' }); };
  const openEdit = (m) => {
    setForm({
      keyword: m.keyword,
      categoryId: m.categoryId?._id || m.categoryId || '',
      subCategory1Id: m.subCategory1Id?._id || m.subCategory1Id || '',
      priority: m.priority,
      caseSensitive: m.caseSensitive,
    });
    setError('');
    setModal({ mode: 'edit', id: m._id });
  };

  const handleSave = async () => {
    if (!form.keyword.trim()) { setError('La keyword è obbligatoria'); return; }
    if (!form.categoryId) { setError('La categoria è obbligatoria'); return; }
    setSaving(true); setError('');
    const payload = { ...form, subCategory1Id: form.subCategory1Id || null, priority: parseInt(form.priority) || 10 };
    const res = await fetch(
      modal.mode === 'edit' ? `/api/impostazioni/keyword-mapping/${modal.id}` : '/api/impostazioni/keyword-mapping',
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
    await fetch(`/api/impostazioni/keyword-mapping/${deleteTarget._id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  const filtered = mappings.filter(m =>
    !search || m.keyword.toLowerCase().includes(search.toLowerCase()) ||
    m.categoryId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">Keyword Mapping</h1>
          <p className="text-sm text-base-content/50 mt-1">
            Associa parole chiave alle categorie per l&apos;auto-categorizzazione durante l&apos;import
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Nuova keyword</button>
      </div>

      <div className="my-4">
        <input type="text" className="input input-bordered input-sm w-full max-w-xs"
          placeholder="Cerca keyword o categoria…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="loading loading-spinner loading-md text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-base-content/40">
          <p className="text-3xl mb-2">🔑</p>
          <p>{search ? 'Nessun risultato' : 'Nessuna keyword configurata'}</p>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
          <table className="table table-sm">
            <thead>
              <tr className="bg-base-200">
                <th>Keyword</th>
                <th>Categoria</th>
                <th>Sotto-cat.</th>
                <th className="text-center">Priorità</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m._id} className="hover">
                  <td>
                    <code className="text-sm bg-base-200 px-1.5 py-0.5 rounded">{m.keyword}</code>
                    {m.caseSensitive && <span className="badge badge-ghost badge-xs ml-1">Cs</span>}
                  </td>
                  <td>
                    {m.categoryId ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.categoryId.color }} />
                        <span className="text-sm">{m.categoryId.name}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="text-sm text-base-content/60">{m.subCategory1Id?.name || '—'}</td>
                  <td className="text-center">
                    <span className="badge badge-ghost badge-sm">{m.priority}</span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(m)}>Modifica</button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteTarget(m)}>Elimina</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal form */}
      {modal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {modal.mode === 'add' ? 'Nuova keyword' : 'Modifica keyword'}
            </h3>
            {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}

            <div className="flex flex-col gap-3">
              <label className="form-control">
                <div className="label"><span className="label-text font-medium">Keyword *</span></div>
                <input type="text" className="input input-bordered" placeholder="es. esselunga"
                  value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value })} autoFocus />
                <div className="label"><span className="label-text-alt text-base-content/50">Viene cercata nella descrizione del movimento bancario</span></div>
              </label>

              <label className="form-control">
                <div className="label"><span className="label-text font-medium">Categoria *</span></div>
                <select className="select select-bordered" value={form.categoryId}
                  onChange={e => setForm({ ...form, categoryId: e.target.value, subCategory1Id: '' })}>
                  <option value="">— Seleziona —</option>
                  {level1.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </label>

              <label className="form-control">
                <div className="label"><span className="label-text">Sotto-categoria <span className="text-base-content/40">(opzionale)</span></span></div>
                <select className="select select-bordered" value={form.subCategory1Id}
                  onChange={e => setForm({ ...form, subCategory1Id: e.target.value })}
                  disabled={!form.categoryId || level2ofSelected.length === 0}>
                  <option value="">— Nessuna —</option>
                  {level2ofSelected.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <div className="label"><span className="label-text">Priorità</span></div>
                  <input type="number" min="1" max="100" className="input input-bordered"
                    value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
                  <div className="label"><span className="label-text-alt text-base-content/40">Valore più alto = ha precedenza</span></div>
                </label>

                <label className="form-control justify-center">
                  <div className="label"><span className="label-text">Case sensitive</span></div>
                  <input type="checkbox" className="toggle toggle-sm"
                    checked={form.caseSensitive} onChange={e => setForm({ ...form, caseSensitive: e.target.checked })} />
                </label>
              </div>
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
            <h3 className="font-bold text-lg">Elimina keyword</h3>
            <p className="py-3 text-sm">Elimina la keyword <code className="bg-base-200 px-1 rounded">{deleteTarget.keyword}</code>?</p>
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
