'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PaymentBadge from '@/components/spese/PaymentBadge';
import { PAYMENT_METHODS } from '@/lib/utils/payments';

const LIMIT = 20;

function formatAmount(n) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function SpesePage() {
  const router = useRouter();

  const [expenses, setExpenses]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [categories, setCategories] = useState([]);

  const [filters, setFilters] = useState({
    from: '', to: '', categoryId: '', paymentMethod: '', paymentGroup: '', search: '', type: '',
  });
  const [activeFilters, setActiveFilters] = useState({ ...filters });

  // Modal eliminazione
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    fetch('/api/categorie')
      .then((r) => r.json())
      .then((data) => setCategories(data.filter((c) => c.level === 1)))
      .catch(() => {});
  }, []);

  const fetchExpenses = useCallback(async (f = activeFilters, p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: LIMIT });
    if (f.from)          params.set('from', f.from);
    if (f.to)            params.set('to', f.to);
    if (f.categoryId)    params.set('categoryId', f.categoryId);
    if (f.paymentMethod) params.set('paymentMethod', f.paymentMethod);
    if (f.paymentGroup)  params.set('paymentGroup', f.paymentGroup);
    if (f.search)        params.set('search', f.search);
    if (f.type)          params.set('type', f.type);

    try {
      const res  = await fetch(`/api/spese?${params}`);
      const data = await res.json();
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {}
    setLoading(false);
  }, [activeFilters, page]);

  useEffect(() => { fetchExpenses(activeFilters, page); }, [activeFilters, page]);

  const applyFilters = () => {
    setPage(1);
    setActiveFilters({ ...filters });
  };

  const resetFilters = () => {
    const empty = { from: '', to: '', categoryId: '', paymentMethod: '', paymentGroup: '', search: '' };
    setFilters(empty);
    setActiveFilters(empty);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/spese/${deleteTarget._id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
    fetchExpenses(activeFilters, page);
  };

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Spese</h1>
          {!loading && <p className="text-sm text-base-content/50">{total} spese trovate</p>}
        </div>
        <Link href="/spese/nuova" className="btn btn-primary btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuova spesa
        </Link>
      </div>

      {/* Filtri */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body py-4 gap-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
            <input
              type="text"
              placeholder="Cerca esercente, causale…"
              className="input input-bordered input-sm col-span-2"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
            <input
              type="date"
              className="input input-bordered input-sm"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              title="Da data"
            />
            <input
              type="date"
              className="input input-bordered input-sm"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              title="A data"
            />
            <select
              className="select select-bordered select-sm"
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
            >
              <option value="">Tutte le categorie</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select
              className="select select-bordered select-sm"
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">Entrate e uscite</option>
              <option value="expense">Solo uscite</option>
              <option value="income">Solo entrate</option>
            </select>

            <select
              className="select select-bordered select-sm"
              value={filters.paymentGroup || filters.paymentMethod}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'traditional' || v === 'alternative') {
                  setFilters({ ...filters, paymentGroup: v, paymentMethod: '' });
                } else {
                  setFilters({ ...filters, paymentMethod: v, paymentGroup: '' });
                }
              }}
            >
              <option value="">Tutti i metodi</option>
              <optgroup label="Gruppi">
                <option value="traditional">Tradizionali</option>
                <option value="alternative">Alternativi</option>
              </optgroup>
              <optgroup label="Specifici">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={applyFilters}>Filtra</button>
            {hasActiveFilters && (
              <button className="btn btn-ghost btn-sm" onClick={resetFilters}>Azzera filtri</button>
            )}
          </div>
        </div>
      </div>

      {/* Tabella */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 text-base-content/50">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium">Nessuna spesa trovata</p>
            {hasActiveFilters && <p className="text-sm mt-1">Prova a modificare i filtri</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="bg-base-200">
                  <th>Data</th>
                  <th>Esercente / Causale</th>
                  <th>Categoria</th>
                  <th>Metodo</th>
                  <th className="text-right">Importo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp._id} className="hover">
                    <td className="whitespace-nowrap text-sm text-base-content/70">
                      {formatDate(exp.date)}
                      {exp.time && <span className="block text-xs text-base-content/40">{exp.time}</span>}
                    </td>
                    <td>
                      <p className="font-medium text-sm">{exp.payee || exp.description || '—'}</p>
                      {exp.payee && exp.description && (
                        <p className="text-xs text-base-content/50">{exp.description}</p>
                      )}
                      {exp.place && <p className="text-xs text-base-content/40">{exp.place}</p>}
                    </td>
                    <td>
                      {exp.categoryId ? (
                        <div className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: exp.categoryId.color }}
                          />
                          <span className="text-sm">{exp.categoryId.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-base-content/30">—</span>
                      )}
                      {exp.subCategory1Id && (
                        <p className="text-xs text-base-content/50 ml-3">{exp.subCategory1Id.name}</p>
                      )}
                    </td>
                    <td>
                      <PaymentBadge value={exp.paymentMethod} size="badge-sm" />
                    </td>
                    <td className={`text-right font-semibold whitespace-nowrap ${exp.type === 'income' ? 'text-success' : ''}`}>
                      {exp.type === 'income' ? '+' : ''}{formatAmount(exp.amount)}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <Link href={`/spese/${exp._id}`} className="btn btn-ghost btn-xs" title="Modifica">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          title="Elimina"
                          onClick={() => setDeleteTarget(exp)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginazione */}
      {pages > 1 && (
        <div className="flex justify-center mt-4">
          <div className="join">
            <button
              className="join-item btn btn-sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >«</button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <button key={`ellipsis-${i}`} className="join-item btn btn-sm btn-disabled">…</button>
                ) : (
                  <button
                    key={p}
                    className={`join-item btn btn-sm ${page === p ? 'btn-active btn-primary' : ''}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
                )
              )}
            <button
              className="join-item btn btn-sm"
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
            >»</button>
          </div>
        </div>
      )}

      {/* Modal conferma eliminazione */}
      {deleteTarget && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Elimina spesa</h3>
            <p className="py-4 text-sm">
              Sei sicuro di voler eliminare la spesa
              {deleteTarget.payee ? <strong> {deleteTarget.payee}</strong> : ''} del{' '}
              <strong>{formatDate(deleteTarget.date)}</strong> di{' '}
              <strong>{formatAmount(deleteTarget.amount)}</strong>?
            </p>
            <p className="text-xs text-base-content/50">Questa azione non è reversibile.</p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>
                Annulla
              </button>
              <button
                className={`btn btn-error btn-sm ${deleting ? 'loading' : ''}`}
                onClick={handleDelete}
                disabled={deleting}
              >
                Elimina
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeleteTarget(null)} />
        </div>
      )}
    </div>
  );
}
