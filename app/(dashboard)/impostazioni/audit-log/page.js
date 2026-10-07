'use client';

import { useState } from 'react';
import { useApiData } from '@/lib/hooks/useApiData';

const ACTION_LABELS = {
  CREATE:          { label: 'Creazione',      color: 'badge-success' },
  UPDATE:          { label: 'Modifica',        color: 'badge-info' },
  DELETE:          { label: 'Eliminazione',    color: 'badge-error' },
  IMPORT:          { label: 'Importazione',    color: 'badge-warning' },
  LOGIN:           { label: 'Accesso',         color: 'badge-ghost' },
  PASSWORD_CHANGE: { label: 'Cambio password', color: 'badge-neutral' },
};

const RESOURCE_LABELS = {
  movement: 'Movimento',
  category: 'Categoria',
  template: 'Template',
  keyword:  'Keyword',
  user:     'Utente',
  system:   'Sistema',
};

const LIMIT = 25;

export default function AuditLogPage() {
  const [page, setPage]       = useState(1);
  const [sortDir, setSortDir] = useState('desc');

  const [filters, setFilters] = useState({ search: '', action: '', resource: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);

  const query = new URLSearchParams({ page, limit: LIMIT, sortDir });
  if (applied.search)   query.set('search',   applied.search);
  if (applied.action)   query.set('action',   applied.action);
  if (applied.resource) query.set('resource', applied.resource);
  if (applied.from)     query.set('from',     applied.from);
  if (applied.to)       query.set('to',       applied.to);
  const { data, loading } = useApiData(`/api/audit?${query}`, 'audit-log');
  const logs  = data?.logs ?? [];
  const total = data?.total ?? 0;

  const pages = Math.ceil(total / LIMIT);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  };

  const handleReset = () => {
    const empty = { search: '', action: '', resource: '', from: '', to: '' };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
    setSortDir('desc');
  };

  const fmt = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>

      {/* Filtri */}
      <form onSubmit={handleSearch} className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body gap-3 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">Cerca</span></div>
              <input
                type="text"
                className="input input-bordered input-sm"
                placeholder="Descrizione o email utente…"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </label>

            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">Azione</span></div>
              <select
                className="select select-bordered select-sm"
                value={filters.action}
                onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
              >
                <option value="">Tutte</option>
                {Object.entries(ACTION_LABELS).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">Risorsa</span></div>
              <select
                className="select select-bordered select-sm"
                value={filters.resource}
                onChange={e => setFilters(f => ({ ...f, resource: e.target.value }))}
              >
                <option value="">Tutte</option>
                {Object.entries(RESOURCE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">Dal</span></div>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
              />
            </label>

            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">Al</span></div>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm">Filtra</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>Reset</button>
          </div>
        </div>
      </form>

      {/* Tabella */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm text-base-content/60">
            {loading ? 'Caricamento…' : `${total} eventi trovati`}
          </span>
          <button
            className="btn btn-ghost btn-xs gap-1"
            onClick={() => { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); setPage(1); }}
            title="Inverti ordine"
          >
            Data {sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Data</th>
                <th>Utente</th>
                <th>Azione</th>
                <th>Risorsa</th>
                <th>Descrizione</th>
              </tr>
            </thead>
            <tbody>
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-base-content/40 py-10">
                    Nessun evento trovato
                  </td>
                </tr>
              )}
              {logs.map(log => {
                const actionMeta    = ACTION_LABELS[log.action]    ?? { label: log.action,   color: 'badge-ghost' };
                const resourceLabel = RESOURCE_LABELS[log.resource] ?? log.resource;
                return (
                  <tr key={log._id} className="hover">
                    <td className="whitespace-nowrap text-xs text-base-content/70">{fmt(log.createdAt)}</td>
                    <td className="text-xs max-w-[140px] truncate" title={log.userEmail}>{log.userEmail}</td>
                    <td><span className={`badge badge-sm ${actionMeta.color}`}>{actionMeta.label}</span></td>
                    <td className="text-xs capitalize">{resourceLabel}</td>
                    <td className="text-xs max-w-xs truncate" title={log.description}>{log.description}</td>
                  </tr>
                );
              })}
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <span className="loading loading-spinner loading-sm" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex justify-center gap-1 p-3 border-t border-base-200">
            <button className="btn btn-xs btn-ghost" disabled={page <= 1}    onClick={() => setPage(1)}>«</button>
            <button className="btn btn-xs btn-ghost" disabled={page <= 1}    onClick={() => setPage(p => p - 1)}>‹</button>
            <span className="btn btn-xs btn-disabled bg-base-200">{page} / {pages}</span>
            <button className="btn btn-xs btn-ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="btn btn-xs btn-ghost" disabled={page >= pages} onClick={() => setPage(pages)}>»</button>
          </div>
        )}
      </div>
    </div>
  );
}
