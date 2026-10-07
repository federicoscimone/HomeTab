/**
 * @fileoverview Monthly pivot report — categories × months table with heatmap cells.
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * Dynamically import xlsx only when the user triggers an export,
 * keeping the initial bundle lean.
 *
 * @param {object} data - Pivot API response.
 * @param {number} year - Selected year.
 * @param {string} type - 'expense' | 'income'.
 * @param {{ category: string, months: string[], total: string, avg: string, avgElapsed: string,
 *   totalCaps: string, sheet: string }} labels - Intestazioni nella lingua dell'interfaccia.
 */
async function exportExcel(data, year, type, labels) {
  const XLSX = (await import('xlsx')).default;
  const showElapsedAvg = Boolean(data.isCurrentYear && data.elapsedMonths > 0);
  const header = [
    labels.category,
    ...labels.months,
    labels.total,
    labels.avg,
    ...(showElapsedAvg ? [labels.avgElapsed] : []),
  ];
  const rows   = data.rows.map(r => [
    r.categoryName,
    ...Array.from({ length: 12 }, (_, i) => r.monthly[i + 1] || 0),
    r.total,
    r.avg,
    ...(showElapsedAvg ? [r.avgElapsed] : []),
  ]);
  const totRow = [
    labels.totalCaps,
    ...Array.from({ length: 12 }, (_, i) => data.monthTotals[i + 1] || 0),
    data.grandTotal,
    data.grandTotal / 12,
    ...(showElapsedAvg ? [data.grandAvgElapsed] : []),
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, labels.sheet);
  XLSX.writeFile(wb, `hometab-pivot-${year}-${type}.xlsx`);
}

/**
 * Monthly pivot report page.
 * Desktop: full table with heatmap. Mobile: scrollable compact table.
 */
export default function PivotPage() {
  const now = new Date();
  const [year,         setYear]         = useState(now.getFullYear());
  const [type,         setType]         = useState('expense');
  const [paymentGroup, setPaymentGroup] = useState('');
  const t = useTranslations('reports.pivot');
  const tCommon = useTranslations('common');
  const tGroups = useTranslations('paymentGroups');
  const { fmt, fmtFull, monthsShort } = useFormat();

  const query = new URLSearchParams({ year, type });
  if (paymentGroup) query.set('paymentGroup', paymentGroup);
  const { data, loading, error } = useApiData(`/api/report/pivot?${query}`, 'pivot');

  const handleExport = useCallback(() => {
    if (!data) return;
    exportExcel(data, year, type, {
      category: tCommon('category'), months: monthsShort, total: tCommon('total'),
      avg: tCommon('avgPerMonth'), avgElapsed: t('avgElapsed', { months: data.elapsedMonths }),
      totalCaps: tCommon('totalCaps'), sheet: t('sheet', { year: String(year) }),
    }).catch(err =>
      console.error('[pivot] export error:', err),
    );
  }, [data, year, type, t, tCommon, monthsShort]);

  // A gennaio nessun mese è ancora chiuso: la colonna "Media/0m" non avrebbe senso.
  const showElapsedAvg = Boolean(data?.isCurrentYear && data.elapsedMonths > 0);
  const elapsedAvgLabel = showElapsedAvg ? t('avgElapsed', { months: data.elapsedMonths }) : '';

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-base-content/50">{t('subtitle')}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!data}>
          {'↓'} {tCommon('exportExcel')}
        </button>
      </div>

      {/* ── Filtri ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select className="select select-bordered select-sm" value={year}
          onChange={e => setYear(parseInt(e.target.value))} aria-label={tCommon('year')}>
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <div className="tabs tabs-box">
          {[['expense', tCommon('expenses')], ['income', tCommon('income')]].map(([v, l]) => (
            <button key={v} className={`tab tab-sm ${type === v ? 'tab-active' : ''}`}
              onClick={() => setType(v)}>{l}</button>
          ))}
        </div>

        <select className="select select-bordered select-sm" value={paymentGroup}
          onChange={e => setPaymentGroup(e.target.value)} aria-label={t('paymentMethod')}>
          <option value="">{tGroups('allMethods')}</option>
          <option value="traditional">{tGroups('onlyTraditional')}</option>
          <option value="alternative">{tGroups('onlyAlternative')}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : error ? (
        <div className="alert alert-warning"><span>{tCommon('loadError')}</span></div>
      ) : !data?.rows?.length ? (
        <div className="text-center py-16 text-base-content/40">
          <p className="text-4xl mb-2">{'📊'}</p>
          <p>{tCommon('noDataForYear', { year: String(year) })}</p>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-xs text-xs">
              <thead>
                <tr className="bg-base-200">
                  <th className="sticky left-0 bg-base-200 z-10 min-w-[120px] sm:min-w-[140px]">{tCommon('category')}</th>
                  {monthsShort.map(m => <th key={m} className="text-right">{m}</th>)}
                  <th className="text-right font-bold">{tCommon('total')}</th>
                  <th className="text-right text-base-content/60">{t('avgShort')}</th>
                  {showElapsedAvg && (
                    <th className="text-right text-base-content/60">{elapsedAvgLabel}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={row.categoryId} className="hover">
                    <td className="sticky left-0 bg-base-100 z-10 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: row.color }} />
                        <span className="truncate max-w-[100px] sm:max-w-[130px]">
                          {row.categoryName}
                        </span>
                      </div>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                      const v   = row.monthly[m] || 0;
                      const pct = data.monthTotals[m] > 0 ? v / data.monthTotals[m] : 0;
                      return (
                        <td key={m} className="text-right relative" title={v ? fmtFull(v) : ''}>
                          {v > 0 && (
                            <div
                              className="absolute inset-0 opacity-10 rounded"
                              style={{ backgroundColor: row.color, width: `${pct * 100}%`, marginLeft: 'auto' }}
                            />
                          )}
                          <span className={v > 0 ? 'font-medium' : 'text-base-content/20'}>
                            {v > 0 ? fmt(v) : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="text-right font-bold">{fmt(row.total)}</td>
                    <td className="text-right text-base-content/50">{fmt(row.avg)}</td>
                    {showElapsedAvg && (
                      <td className="text-right text-base-content/50">{fmt(row.avgElapsed)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-base-200 font-bold">
                  <td className="sticky left-0 bg-base-200 z-10">{tCommon('totalCaps')}</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <td key={m} className="text-right">{fmt(data.monthTotals[m] || 0)}</td>
                  ))}
                  <td className="text-right">{fmt(data.grandTotal)}</td>
                  <td className="text-right text-base-content/60">{fmt(data.grandTotal / 12)}</td>
                  {showElapsedAvg && (
                    <td className="text-right text-base-content/60">{fmt(data.grandAvgElapsed)}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
