/**
 * @fileoverview Expense/income list page with filters, pagination, and delete.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PaymentBadge from '@/components/movimenti/PaymentBadge';
import MappingModal from '@/components/shared/MappingModal';
import { PAYMENT_METHODS } from '@/lib/utils/payments';
import { useFormat } from '@/lib/hooks/useFormat';
import useCan from '@/lib/auth/useCan';

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

function SortTh({ field, current, dir, onClick, className = '', children }) {
  const active = current === field;
  const justifyClass = className.includes('text-right') ? 'justify-end' : '';
  return (
    <th
      className={`cursor-pointer select-none hover:bg-base-300 transition-colors ${className}`}
      onClick={() => onClick(field)}
    >
      <span className={`flex items-center gap-1 ${justifyClass}`}>
        {children}
        <span className={`text-xs ${active ? 'text-primary' : 'text-base-content/30'}`}>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
}

/** @typedef {{ from:string, to:string, categoryIds:string[], paymentMethod:string, paymentGroup:string, search:string, type:string, incomplete:boolean, excludeFromAnalysis:boolean }} Filters */

/** @type {Filters} */
const EMPTY_FILTERS = {
  from: '', to: '', categoryIds: [], paymentMethod: '', paymentGroup: '', search: '', type: '', incomplete: false, excludeFromAnalysis: false,
};

/**
 * @param {URLSearchParams} searchParams
 * @returns {Filters} Filtri passati nell'URL; quelli assenti restano vuoti.
 */
function filtersFromSearchParams(searchParams) {
  return {
    ...EMPTY_FILTERS,
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    categoryIds: (searchParams.get('categoryIds') || '').split(',').map(v => v.trim()).filter(Boolean),
    type: searchParams.get('type') || '',
    incomplete: searchParams.get('incomplete') === '1',
    excludeFromAnalysis: searchParams.get('excludeFromAnalysis') === '1',
  };
}

/**
 * Query string di /api/movimenti per filtri, pagina e ordinamento.
 *
 * @param {Filters} f
 * @param {number}  p
 * @param {string}  s  - Campo di ordinamento.
 * @param {string}  sd - 'asc' | 'desc'.
 */
function expensesQuery(f, p, s, sd) {
  const params = new URLSearchParams({ page: p, limit: PAGE_SIZE, sort: s, sortDir: sd });
  if (f.from)          params.set('from',          f.from);
  if (f.to)            params.set('to',            f.to);
  if (f.categoryIds && f.categoryIds.length > 0) params.set('categoryIds', f.categoryIds.join(','));
  if (f.paymentMethod) params.set('paymentMethod', f.paymentMethod);
  if (f.paymentGroup)  params.set('paymentGroup',  f.paymentGroup);
  if (f.search)        params.set('search',        f.search);
  if (f.type)          params.set('type',          f.type);
  if (f.incomplete)    params.set('incomplete',    '1');
  if (f.excludeFromAnalysis) params.set('excludeFromAnalysis', '1');
  return params.toString();
}

/**
 * Expense list page — filterable, paginated table of all expense/income records.
 * On mobile, renders as stacked cards instead of a table.
 */
export default function SpesePage() {
  const searchParams = useSearchParams();
  const canDo = useCan();
  const t = useTranslations('movements');
  const tCommon = useTranslations('common');
  const tGroups = useTranslations('paymentGroups');
  const tPay = useTranslations('payments');
  const { fmtFull } = useFormat();
  const searchParamsKey = searchParams.toString();
  const [expenses, setExpenses]     = useState([]);
  const [total,    setTotal]        = useState(0);
  const [pages,    setPages]        = useState(1);
  const [page,     setPage]         = useState(1);
  const [categories, setCategories] = useState([]);

  const [filters,       setFilters]       = useState(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const [sort,    setSort]    = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [deleting,        setDeleting]        = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);
  const [exporting,       setExporting]       = useState(false);
  const [mappingModal,    setMappingModal]    = useState(null); // { keyword, categoryId, subCategory1Id, priority, caseSensitive }
  const [mappingError,    setMappingError]    = useState('');
  const [actionError,     setActionError]     = useState('');

  useEffect(() => {
    fetch('/api/movimenti?incomplete=1&limit=1')
      .then(r => r.json())
      .then(d => setIncompleteCount(d.total ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/categorie')
      .then(r => r.json())
      .then(data => setCategories(data))
      .catch(err => console.error('[spese] categorie fetch error:', err));
  }, []);

  // I filtri arrivano anche dall'URL (link da dashboard e report). Si applicano durante il render
  // quando l'URL cambia, non in un effetto: così la prima richiesta parte già con i filtri giusti
  // e non serve un flag che la trattenga finché l'effetto non ha copiato i parametri.
  const [syncedKey, setSyncedKey] = useState(null);
  if (syncedKey !== searchParamsKey) {
    const incoming = filtersFromSearchParams(searchParams);
    setSyncedKey(searchParamsKey);
    setFilters(incoming);
    setActiveFilters(incoming);
    setPage(1);
  }

  // Elenco: la richiesta corrente è descritta da requestKey, e il caricamento è finito quando
  // l'ultima risposta arrivata porta la stessa chiave. Una risposta superata viene annullata.
  const [reloadVersion, setReloadVersion] = useState(0);
  const reloadExpenses = () => setReloadVersion(v => v + 1);
  const requestQuery = expensesQuery(activeFilters, page, sort, sortDir);
  const requestKey = `${reloadVersion}:${requestQuery}`;
  const [loaded, setLoaded] = useState({ key: null, error: false });
  const loading = loaded.key !== requestKey;
  const error = !loading && loaded.error;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/movimenti?${requestQuery}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setExpenses(data.expenses || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setLoaded({ key: requestKey, error: false });
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        console.error('[spese] fetchExpenses error:', err);
        setLoaded({ key: requestKey, error: true });
      });
    return () => controller.abort();
  }, [requestKey, requestQuery]);

  const handleSort = (field) => {
    if (sort === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const applyFilters = useCallback(() => {
    setPage(1);
    setActiveFilters({ ...filters });
  }, [filters]);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  /** Toggles excludeFromAnalysis for a single expense (optimistic update). */
  const handleToggleExclude = async (exp) => {
    const newVal = !exp.excludeFromAnalysis;
    const setExcluded = (value) =>
      setExpenses(prev => prev.map(e => e._id === exp._id ? { ...e, excludeFromAnalysis: value } : e));
    // Aggiornamento ottimistico: se il server rifiuta, la casella torna com'era e lo si dice.
    // Prima l'errore veniva ignorato e la lista mostrava uno stato che il database non aveva.
    setExcluded(newVal);
    setActionError('');
    try {
      const res = await fetch(`/api/movimenti/${exp._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludeFromAnalysis: newVal }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('[spese] toggle exclude error:', err);
      setExcluded(!newVal);
      setActionError(t('toggleFailed'));
    }
  };

  /** Deletes the currently targeted expense and refreshes the list. */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError('');
    try {
      const res = await fetch(`/api/movimenti/${deleteTarget._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('[spese] delete error:', err);
      setActionError(t('deleteFailed'));
    }
    setDeleting(false);
    setDeleteTarget(null);
    reloadExpenses();
  };

  const filterIncomplete = useCallback(() => {
    const f = { ...EMPTY_FILTERS, incomplete: true };
    setFilters(f);
    setActiveFilters(f);
    setPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setActionError('');
    try {
      const params = new URLSearchParams();
      if (activeFilters.from)          params.set('from',          activeFilters.from);
      if (activeFilters.to)            params.set('to',            activeFilters.to);
      if (activeFilters.categoryIds && activeFilters.categoryIds.length > 0) params.set('categoryIds', activeFilters.categoryIds.join(','));
      if (activeFilters.paymentMethod) params.set('paymentMethod', activeFilters.paymentMethod);
      if (activeFilters.paymentGroup)  params.set('paymentGroup',  activeFilters.paymentGroup);
      if (activeFilters.search)        params.set('search',        activeFilters.search);
      if (activeFilters.type)          params.set('type',          activeFilters.type);
      if (activeFilters.incomplete)    params.set('incomplete',    '1');
      if (activeFilters.excludeFromAnalysis) params.set('excludeFromAnalysis', '1');

      const res = await fetch(`/api/movimenti/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `hometab-movimenti-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[export]', err);
      setActionError(tCommon('exportError'));
    } finally {
      setExporting(false);
    }
  }, [activeFilters, tCommon]);

  const level1 = categories.filter(c => c.level === 1);
  const level2of = (catId) => categories.filter(c => c.level === 2 && c.parentId?.toString() === catId);

  const openMappingModal = (exp) => {
    setMappingError('');
    setMappingModal({
      keyword:        exp.payee || exp.description || '',
      categoryId:     '',
      subCategory1Id: '',
      priority:       10,
      caseSensitive:  false,
    });
  };

  const handleMappingConfirm = async () => {
    if (!mappingModal.keyword.trim()) { setMappingError(t('mappingKeywordRequired')); return; }
    if (!mappingModal.categoryId)     { setMappingError(t('mappingCategoryRequired')); return; }
    setMappingError('');

    const body = {
      keyword:        mappingModal.keyword.trim(),
      categoryId:     mappingModal.categoryId,
      subCategory1Id: mappingModal.subCategory1Id || null,
      priority:       Number(mappingModal.priority) || 10,
      caseSensitive:  !!mappingModal.caseSensitive,
    };

    // 1. Save the keyword mapping rule
    const r1 = await fetch('/api/impostazioni/keyword-mapping', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r1.ok) { setMappingError(t('mappingSaveFailed')); return; }

    // 2. Bulk-categorize matching movements already in the DB
    await fetch('/api/movimenti/bulk-categorize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });

    setMappingModal(null);
    // Refresh table and incomplete counter
    reloadExpenses();
    fetch('/api/movimenti?incomplete=1&limit=1')
      .then(r => r.json())
      .then(d => setIncompleteCount(d.total ?? 0))
      .catch(() => {});
  };

  const hasActiveFilters = activeFilters.from || activeFilters.to || activeFilters.categoryIds.length > 0 || activeFilters.paymentMethod || activeFilters.paymentGroup || activeFilters.search || activeFilters.type || activeFilters.incomplete || activeFilters.excludeFromAnalysis;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('title')}</h1>
          {!loading && (
            <p className="text-sm text-base-content/50">{t('found', { count: total })}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-outline btn-sm gap-1"
            onClick={handleExport}
            disabled={exporting || loading}
            title={hasActiveFilters ? t('exportFiltered') : t('exportAll')}
          >
            {exporting ? <span className="loading loading-spinner loading-xs" /> : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            <span className="hidden sm:inline">{exporting ? t('exporting') : tCommon('exportExcel')}</span>
          </button>
          {canDo('movements:create') && (
          <Link href="/movimenti/nuova" className="btn btn-primary btn-sm gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{t('new')}</span>
            <span className="sm:hidden">{t('newShort')}</span>
          </Link>
          )}
        </div>
      </div>

      {actionError && (
        <div className="alert alert-error mb-4 text-sm" role="alert">
          <span>{actionError}</span>
          <button className="btn btn-ghost btn-xs ml-auto" onClick={() => setActionError('')} aria-label={tCommon('close')}>{'✕'}</button>
        </div>
      )}

      {/* ── Alert movimenti incompleti ─────────────────────────────── */}
      {incompleteCount > 0 && !activeFilters.incomplete && (
        <button
          type="button"
          onClick={filterIncomplete}
          className="alert alert-warning mb-4 cursor-pointer hover:brightness-95 transition-all text-left w-full"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="font-semibold text-sm">{t('incomplete', { count: incompleteCount })}</p>
            <p className="text-xs opacity-80">{t('incompleteHint')}</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-auto flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* ── Filtri ──────────────────────────────────────────────────── */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body py-4 gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
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
              aria-label={t('fromDate')}
            />
            <input
              type="date"
              className="input input-bordered input-sm"
              value={filters.to}
              onChange={e => setFilters({ ...filters, to: e.target.value })}
              aria-label={t('toDate')}
            />
            <div className="relative" onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}>
              <button
                type="button"
                className="select select-bordered select-sm w-full text-left justify-between flex items-center"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <span className="truncate">
                  {filters.categoryIds.length === 0
                    ? t('allCategories')
                    : filters.categoryIds.length === 1
                    ? categories.find(c => c._id === filters.categoryIds[0])?.name || tCommon('category')
                    : t('categoriesCount', { count: filters.categoryIds.length })}
                </span>
                <svg className={`w-4 h-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              {showCategoryDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  <div className="p-2 border-b border-base-200 sticky top-0 bg-base-100">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-block text-xs justify-start"
                      onClick={() => setFilters({ ...filters, categoryIds: categories.filter(c => c.level === 1).map(c => c._id) })}
                    >
                      {tCommon('selectAll')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-block text-xs justify-start"
                      onClick={() => setFilters({ ...filters, categoryIds: [] })}
                    >
                      {tCommon('deselectAll')}
                    </button>
                  </div>
                  <div className="p-2 space-y-1">
                    {categories.filter(c => c.level === 1).map(cat => (
                      <label key={cat._id} className="flex items-center gap-2 p-2 hover:bg-base-200 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={filters.categoryIds.includes(cat._id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFilters({ ...filters, categoryIds: [...filters.categoryIds, cat._id] });
                            } else {
                              setFilters({ ...filters, categoryIds: filters.categoryIds.filter(id => id !== cat._id) });
                            }
                          }}
                        />
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm flex-1">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <select
              className="select select-bordered select-sm"
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
              aria-label={t('type')}
            >
              <option value="">{t('allTypes')}</option>
              <option value="expense">{t('onlyExpenses')}</option>
              <option value="income">{t('onlyIncome')}</option>
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
              aria-label={t('paymentMethod')}
            >
              <option value="">{tGroups('allMethods')}</option>
              <optgroup label={t('groups')}>
                <option value="traditional">{tGroups('traditional')}</option>
                <option value="alternative">{tGroups('alternative')}</option>
              </optgroup>
              <optgroup label={t('specific')}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{tPay(m.value)}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn btn-primary btn-sm" onClick={applyFilters}>{t('filter')}</button>
            {hasActiveFilters && (
              <button className="btn btn-ghost btn-sm" onClick={resetFilters}>{t('resetFilters')}</button>
            )}
            {activeFilters.incomplete && (
              <span className="badge badge-warning gap-1 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {t('onlyIncomplete')}
              </span>
            )}
            {activeFilters.excludeFromAnalysis && (
              <span className="badge badge-info gap-1 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {t('onlyExcluded')}
              </span>
            )}
            <label className="flex items-center gap-2 cursor-pointer ml-auto">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={filters.excludeFromAnalysis ?? false}
                onChange={e => setFilters({ ...filters, excludeFromAnalysis: e.target.checked })}
              />
              <span className="text-sm">{t('excludedFilter')}</span>
            </label>
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
          <span>{tCommon('loadError')}</span>
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-base-content/50">
          <p className="text-4xl mb-3">{'📭'}</p>
          <p className="font-medium">{t('empty')}</p>
          {hasActiveFilters && <p className="text-sm mt-1">{t('emptyHint')}</p>}
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
                          <span className="badge badge-ghost badge-xs flex-shrink-0" title={t('excludedTitle')}>{t('excludedBadge')}</span>
                        )}
                        {!exp.categoryId && canDo('settings:manage') && (
                          <button
                            className="btn btn-ghost btn-xs p-0 h-4 min-h-0 w-4 opacity-30 hover:opacity-80 flex-shrink-0"
                            title={t('createMapping')}
                            onClick={() => openMappingModal(exp)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {exp.payee && exp.description && (
                        <p className="text-xs text-base-content/50 truncate">{exp.description}</p>
                      )}
                    </div>
                    <span className={`font-bold text-sm whitespace-nowrap flex-shrink-0 ${exp.type === 'income' ? 'text-success' : 'text-error'}`}>
                      {exp.type === 'income' ? '+' : '-'}{fmtFull(exp.amount)}
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
                    <div className="flex gap-1 items-center">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-warning"
                        checked={!!exp.excludeFromAnalysis}
                        onChange={() => handleToggleExclude(exp)}
                        disabled={!canDo('movements:edit')}
                        title={exp.excludeFromAnalysis ? t('includeInAnalysis') : t('excludeFromAnalysis')}
                      />
                      {canDo('movements:edit') && (
                      <Link href={`/movimenti/${exp._id}`} className="btn btn-ghost btn-sm py-1 px-2" aria-label={t('edit')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      )}
                      {canDo('movements:delete') && (
                      <button
                        className="btn btn-ghost btn-sm py-1 px-2 text-error"
                        onClick={() => setDeleteTarget(exp)}
                        aria-label={t('delete')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block">
          <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-base-200">
                    <SortTh field="date"   current={sort} dir={sortDir} onClick={handleSort}>{t('columns.date')}</SortTh>
                    <SortTh field="payee"  current={sort} dir={sortDir} onClick={handleSort}>{t('columns.payee')}</SortTh>
                    <th>{tCommon('category')}</th>
                    <th>{t('columns.method')}</th>
                    <th>{t('columns.notes')}</th>
                    <SortTh field="amount" current={sort} dir={sortDir} onClick={handleSort} className="text-right">{t('columns.amount')}</SortTh>
                    <th className="text-center" title={t('excludeFromAnalysis')}>{t('columns.exclude')}</th>
                    <th className="text-right"></th>
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
                            <span className="badge badge-ghost badge-xs flex-shrink-0" title={t('excludedTitle')}>{t('excludedBadge')}</span>
                          )}
                          {!exp.categoryId && canDo('settings:manage') && (
                            <button
                              className="btn btn-ghost btn-xs p-0 h-4 min-h-0 w-4 opacity-30 hover:opacity-80 flex-shrink-0"
                              title={t('createMapping')}
                              onClick={() => openMappingModal(exp)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {exp.payee && exp.description && (
                          <p className="text-xs text-base-content/50 truncate">{exp.description}</p>
                        )}
                        {exp.place && <p className="text-xs text-base-content/40 truncate">{exp.place}</p>}
                      </td>
                      <td>
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
                      <td>
                        <PaymentBadge value={exp.paymentMethod} size="badge-sm" />
                      </td>
                      <td className="max-w-[180px]">
                        {exp.notes
                          ? <p className="text-xs text-base-content/60 truncate" title={exp.notes}>{exp.notes}</p>
                          : <span className="text-xs text-base-content/20">—</span>}
                      </td>
                      <td className={`text-right font-semibold whitespace-nowrap ${exp.type === 'income' ? 'text-success' : 'text-error'}`}>
                        {exp.type === 'income' ? '+' : '-'}{fmtFull(exp.amount)}
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-warning"
                          checked={!!exp.excludeFromAnalysis}
                          onChange={() => handleToggleExclude(exp)}
                          disabled={!canDo('movements:edit')}
                          title={exp.excludeFromAnalysis ? t('includeInAnalysis') : t('excludeFromAnalysis')}
                        />
                      </td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          {canDo('movements:edit') && (
                          <Link href={`/movimenti/${exp._id}`} className="btn btn-ghost btn-sm" aria-label={t('edit')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          )}
                          {canDo('movements:delete') && (
                          <button
                            className="btn btn-ghost btn-sm text-error"
                            onClick={() => setDeleteTarget(exp)}
                            aria-label={t('delete')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex justify-center mt-4">
          <div className="join">
            <button className="join-item btn btn-sm" disabled={page === 1}
              onClick={() => setPage(p => p - 1)} aria-label={t('prevPage')}>{'«'}</button>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 2)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <button key={`ell-${i}`} className="join-item btn btn-sm btn-disabled">{'…'}</button>
                ) : (
                  <button key={p}
                    className={`join-item btn btn-sm ${page === p ? 'btn-active btn-primary' : ''}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
                ),
              )}
            <button className="join-item btn btn-sm" disabled={page === pages}
              onClick={() => setPage(p => p + 1)} aria-label={t('nextPage')}>{'»'}</button>
          </div>
        </div>
      )}

      {/* ── Mapping modal ───────────────────────────────────────────── */}
      {mappingModal && (
        <MappingModal
          modal={mappingModal}
          onChange={patch => setMappingModal(m => ({ ...m, ...patch }))}
          onConfirm={handleMappingConfirm}
          onClose={() => setMappingModal(null)}
          level1={level1}
          level2of={level2of}
          error={mappingError}
        />
      )}

      {/* ── Delete modal ────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-md">
            <h3 className="font-bold text-lg">{t('deleteTitle')}</h3>
            <p className="py-4 text-sm">
              {t.rich(deleteTarget.payee ? 'deleteConfirm' : 'deleteConfirmNoPayee', {
                payee: deleteTarget.payee,
                date: formatDate(deleteTarget.date),
                amount: fmtFull(deleteTarget.amount),
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <p className="text-xs text-base-content/50">{t('irreversible')}</p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>{tCommon('cancel')}</button>
              <button className="btn btn-error btn-sm" onClick={handleDelete} disabled={deleting}>
                {deleting && <span className="loading loading-spinner loading-xs" />}
                {t('delete')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDeleteTarget(null)} />
        </div>
      )}
    </div>
  );
}
