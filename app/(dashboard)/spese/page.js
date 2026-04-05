/**
 * @fileoverview Expense/income list page with filters, pagination, and delete.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PaymentBadge from '@/components/spese/PaymentBadge';
import { PAYMENT_METHODS } from '@/lib/utils/payments';
import { fmtFull } from '@/lib/utils/format';

/** Number of records per page. */
const PAGE_SIZE = 20;

/**
 * Formats a YYYY-MM-DD string to DD/MM/YYYY for display.
 *
 * @param {string} d - ISO date string.
 * @returns {string}
 */
function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/** @typedef {{ from:string, to:string, categoryId:string, paymentMethod:string, paymentGroup:string, search:string, type:string }} Filters */

/** @type {Filters} */
const EMPTY_FILTERS = {
  from: '', to: '', categoryId: '', paymentMethod: '', paymentGroup: '', search: '', type: '',
};

/**
 * Expense list page — filterable, paginated table of all expense/income records.
 * On mobile, renders as stacked cards instead of a table.
 */
export default function SpesePage() {
  const [expenses, setExpenses]     = useState([]);
  const [total,    setTotal]        = useState(0);
  const [pages,    setPages]        = useState(1);
  const [page,     setPage]         = useState(1);
  const [loading,  setLoading]      = useState(true);
  const [error,    setError]        = useState(false);
  const [categories, setCategories] = useState([]);

  const [filters,       setFilters]       = useState(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => {
    fetch('/api/categorie')
      .then(r => r.json())
      .then(data => setCategories(data.filter(c => c.level === 1)))
      .catch(err => console.error('[spese] categorie fetch error:', err));
  }, []);

  /**
   * Fetches the expense list from the API.
   *
   * @param {Filters} f - Active filter state.
   * @param {number}  p - Current page number.
   */
  const fetchExpenses = useCallback(async (f, p) => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
    if (f.from)          params.set('from',          f.from);
    if (f.to)            params.set('to',            f.to);
    if (f.categoryId)    params.set('categoryId',    f.categoryId);
    if (f.paymentMethod) params.set('paymentMethod', f.paymentMethod);
    if (f.paymentGroup)  params.set('paymentGroup',  f.paymentGroup);
    if (f.search)        params.set('search',        f.search);
    if (f.type)          params.set('type',          f.type);

    try {
      const res  = await fetch(`/api/spese?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      console.error('[spese] fetchExpenses error:', err);
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExpenses(activeFilters, page);
  }, [fetchExpenses, activeFilters, page]);

  const applyFilters = useCallback(() => {
    setPage(1);
    setActiveFilters({ ...filters });
  }, [filters]);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  /** Deletes the currently targeted expense and refreshes the list. */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/spese/${deleteTarget._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('[spese] delete error:', err);
    }
    setDeleting(false);
    setDeleteTarget(null);
    fetchExpenses(activeFilters, page);
  };

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Spese</h1>
          {!loading && (
            <p className="text-sm text-base-content/50">{total} movimenti trovati</p>
          )}
        </div>
        <Link href="/spese/nuova" className="btn btn-primary btn-sm gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden xs:inline">Nuova spesa</span>
          <span className="xs:hidden">Nuova</span>
        </Link>
      </div>

      {/* ── Filtri ──────────────────────────────────────────────────── */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body py-4 gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            <input
              type="text"
              placeholder="Cerca esercente, causale…"
              className="input input-bordered input-sm sm:col-span-2 xl:col-span-2"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
            <input
              type="date"
              className="input input-bordered input-sm"
              value={filters.from}
              onChange={e => setFilters({ ...filters, from: e.target.value })}
              aria-label="Da data"
            />
            <input
              type="date"
              className="input input-bordered input-sm"
              value={filters.to}
              onChange={e => setFilters({ ...filters, to: e.target.value })}
              aria-label="A data"
            />
            <select
              className="select select-bordered select-sm"
              value={filters.categoryId}
              onChange={e => setFilters({ ...filters, categoryId: e.target.value })}
              aria-label="Categoria"
            >
              <option value="">Tutte le categorie</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select
              className="select select-bordered select-sm"
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
              aria-label="Tipo"
            >
              <option value="">Entrate e uscite</option>
              <option value="expense">Solo uscite</option>
              <option value="income">Solo entrate</option>
            </select>
            <select
              className="select select-bordered select-sm"
              value={filters.paymentGroup || filters.paymentMethod}
              onChange={e => {
                const v = e.target.value;
                if (v === 'traditional' || v === 'alternative') {
                  setFilters({ ...filters, paymentGroup: v, paymentMethod: '' });
                } else {
                  setFilters({ ...filters, paymentMethod: v, paymentGroup: '' });
                }
              }}
              aria-label="Metodo di pagamento"
            >
              <option value="">Tutti i metodi</option>
              <optgroup label="Gruppi">
                <option value="traditional">Tradizionali</option>
                <option value="alternative">Alternativi</option>
              </optgroup>
              <optgroup label="Specifici">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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

      {/* ── List / table ────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : error ? (
        <div className="alert alert-warning">
          <span>Errore nel caricamento. Riprova.</span>
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-base-content/50">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">Nessuna spesa trovata</p>
          {hasActiveFilters && <p className="text-sm mt-1">Prova a modificare i filtri</p>}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-2 sm:hidden">
            {expenses.map(exp => (
              <div key={exp._id} className={`card bg-base-100 border border-base-200 shadow-sm ${exp.excludeFromAnalysis ? 'opacity-60' : ''}`}>
                <div className="card-body p-3 gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate">
                          {exp.payee || exp.description || '—'}
                        </p>
                        {exp.excludeFromAnalysis && (
                          <span className="badge badge-ghost badge-xs flex-shrink-0" title="Escluso dalle analisi">escluso</span>
                        )}
                      </div>
                      {exp.payee && exp.description && (
                        <p className="text-xs text-base-content/50 truncate">{exp.description}</p>
                      )}
                    </div>
                    <span className={`font-bold text-sm whitespace-nowrap flex-shrink-0 ${exp.type === 'income' ? 'text-success' : ''}`}>
                      {exp.type === 'income' ? '+' : ''}{fmtFull(exp.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-base-content/50">{formatDate(exp.date)}</span>
                      {exp.categoryId && (
                        <span className="flex items-center gap-1 text-xs text-base-content/70">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: exp.categoryId.color }} />
                          {exp.categoryId.name}
                        </span>
                      )}
                      <PaymentBadge value={exp.paymentMethod} size="badge-xs" />
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/spese/${exp._id}`} className="btn btn-ghost btn-sm py-1 px-2" aria-label="Modifica">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        className="btn btn-ghost btn-sm py-1 px-2 text-error"
                        onClick={() => setDeleteTarget(exp)}
                        aria-label="Elimina"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-base-200">
                    <th>Data</th>
                    <th>Esercente / Causale</th>
                    <th className="hidden lg:table-cell">Categoria</th>
                    <th className="hidden md:table-cell">Metodo</th>
                    <th className="text-right">Importo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp._id} className={`hover ${exp.excludeFromAnalysis ? 'opacity-60' : ''}`}>
                      <td className="whitespace-nowrap text-sm text-base-content/70">
                        {formatDate(exp.date)}
                        {exp.time && <span className="block text-xs text-base-content/40">{exp.time}</span>}
                      </td>
                      <td className="max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{exp.payee || exp.description || '—'}</p>
                          {exp.excludeFromAnalysis && (
                            <span className="badge badge-ghost badge-xs flex-shrink-0" title="Escluso dalle analisi">escluso</span>
                          )}
                        </div>
                        {exp.payee && exp.description && (
                          <p className="text-xs text-base-content/50 truncate">{exp.description}</p>
                        )}
                        {exp.place && <p className="text-xs text-base-content/40 truncate">{exp.place}</p>}
                      </td>
                      <td className="hidden lg:table-cell">
                        {exp.categoryId ? (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: exp.categoryId.color }} />
                            <span className="text-sm">{exp.categoryId.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-base-content/30">—</span>
                        )}
                        {exp.subCategory1Id && (
                          <p className="text-xs text-base-content/50 ml-3">{exp.subCategory1Id.name}</p>
                        )}
                      </td>
                      <td className="hidden md:table-cell">
                        <PaymentBadge value={exp.paymentMethod} size="badge-sm" />
                      </td>
                      <td className={`text-right font-semibold whitespace-nowrap ${exp.type === 'income' ? 'text-success' : ''}`}>
                        {exp.type === 'income' ? '+' : ''}{fmtFull(exp.amount)}
                      </td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <Link href={`/spese/${exp._id}`} className="btn btn-ghost btn-sm" aria-label="Modifica">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            className="btn btn-ghost btn-sm text-error"
                            onClick={() => setDeleteTarget(exp)}
                            aria-label="Elimina"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          </div>
        </>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex justify-center mt-4">
          <div className="join">
            <button className="join-item btn btn-sm" disabled={page === 1}
              onClick={() => setPage(p => p - 1)} aria-label="Pagina precedente">«</button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 2)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <button key={`ell-${i}`} className="join-item btn btn-sm btn-disabled">…</button>
                ) : (
                  <button key={p}
                    className={`join-item btn btn-sm ${page === p ? 'btn-active btn-primary' : ''}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
                ),
              )}
            <button className="join-item btn btn-sm" disabled={page === pages}
              onClick={() => setPage(p => p + 1)} aria-label="Pagina successiva">»</button>
          </div>
        </div>
      )}

      {/* ── Delete modal ────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-md">
            <h3 className="font-bold text-lg">Elimina spesa</h3>
            <p className="py-4 text-sm">
              Sei sicuro di voler eliminare
              {deleteTarget.payee ? <strong> {deleteTarget.payee}</strong> : ''} del{' '}
              <strong>{formatDate(deleteTarget.date)}</strong> —{' '}
              <strong>{fmtFull(deleteTarget.amount)}</strong>?
            </p>
            <p className="text-xs text-base-content/50">Questa azione non è reversibile.</p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>Annulla</button>
              <button
                className={`btn btn-error btn-sm ${deleting ? 'loading' : ''}`}
                onClick={handleDelete}
                disabled={deleting}
              >Elimina</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeleteTarget(null)} />
        </div>
      )}
    </div>
  );
}
