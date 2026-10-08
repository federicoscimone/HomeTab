'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';

/** Colore di ogni azione; le etichette stanno in messages/*.json, sotto audit.actions. */
const ACTION_COLORS = {
  CREATE:            'badge-success',
  UPDATE:            'badge-info',
  BULK_UPDATE:       'badge-info',
  DELETE:            'badge-error',
  IMPORT:            'badge-warning',
  LOGIN:             'badge-ghost',
  PASSWORD_CHANGE:   'badge-neutral',
  BACKUP_CONNECT:    'badge-ghost',
  BACKUP_RUN:        'badge-ghost',
  BACKUP_FAIL:       'badge-error',
  BACKUP_DISCONNECT: 'badge-ghost',
};

const RESOURCES = ['movement', 'category', 'template', 'keyword', 'user', 'goal', 'backup', 'system'];

const LIMIT = 25;

export default function AuditLogPage() {
  const t = useTranslations('audit');
  const { fmtDateTime } = useFormat();
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

  const actionLabel = (a) => (t.has(`actions.${a}`) ? t(`actions.${a}`) : a);
  const resourceLabel = (r) => (t.has(`resources.${r}`) ? t(`resources.${r}`) : r);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* Filtri */}
      <form onSubmit={handleSearch} className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body gap-3 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">{t('search')}</span></div>
              <input
                type="text"
                className="input input-bordered input-sm"
                placeholder={t('searchPlaceholder')}
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </label>

            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">{t('action')}</span></div>
              <select
                className="select select-bordered select-sm"
                value={filters.action}
                onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
              >
                <option value="">{t('all')}</option>
                {Object.keys(ACTION_COLORS).map((a) => (
                  <option key={a} value={a}>{actionLabel(a)}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">{t('resource')}</span></div>
              <select
                className="select select-bordered select-sm"
                value={filters.resource}
                onChange={e => setFilters(f => ({ ...f, resource: e.target.value }))}
              >
                <option value="">{t('all')}</option>
                {RESOURCES.map((r) => (
                  <option key={r} value={r}>{resourceLabel(r)}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">{t('from')}</span></div>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
              />
            </label>

            <label className="form-control">
              <div className="label py-0"><span className="label-text text-xs">{t('to')}</span></div>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm">{t('filter')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>{t('reset')}</button>
          </div>
        </div>
      </form>

      {/* Tabella */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm text-base-content/60">
            {loading ? t('loading') : t('found', { count: total })}
          </span>
          <button
            className="btn btn-ghost btn-xs gap-1"
            onClick={() => { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); setPage(1); }}
            title={t('invertOrder')}
          >
            {`${t('date')} ${sortDir === 'desc' ? '↓' : '↑'}`}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('columns.user')}</th>
                <th>{t('action')}</th>
                <th>{t('resource')}</th>
                <th>{t('columns.description')}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-base-content/40 py-10">{t('empty')}</td>
                </tr>
              )}
              {logs.map(log => (
                <tr key={log._id} className="hover">
                  <td className="whitespace-nowrap text-xs text-base-content/70">{fmtDateTime(log.createdAt)}</td>
                  <td className="text-xs max-w-[140px] truncate" title={log.userEmail}>{log.userEmail}</td>
                  <td>
                    <span className={`badge badge-sm ${ACTION_COLORS[log.action] ?? 'badge-ghost'}`}>{actionLabel(log.action)}</span>
                  </td>
                  <td className="text-xs">{resourceLabel(log.resource)}</td>
                  <td className="text-xs max-w-xs truncate" title={log.description}>{log.description}</td>
                </tr>
              ))}
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
            <button className="btn btn-xs btn-ghost" disabled={page <= 1} onClick={() => setPage(1)} aria-label={t('firstPage')}>{'«'}</button>
            <button className="btn btn-xs btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label={t('prevPage')}>{'‹'}</button>
            <span className="btn btn-xs btn-disabled bg-base-200">{`${page} / ${pages}`}</span>
            <button className="btn btn-xs btn-ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label={t('nextPage')}>{'›'}</button>
            <button className="btn btn-xs btn-ghost" disabled={page >= pages} onClick={() => setPage(pages)} aria-label={t('lastPage')}>{'»'}</button>
          </div>
        )}
      </div>

      <p className="text-xs text-base-content/50 mt-3">{t('descriptionNote')}</p>
    </div>
  );
}
