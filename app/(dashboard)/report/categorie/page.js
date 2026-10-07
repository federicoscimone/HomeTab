/**
 * @fileoverview Per-category report — monthly trend and YoY comparison.
 */

'use client';

import { useState, useCallback } from 'react';
import { useApiData } from '@/lib/hooks/useApiData';
import MonthlyLineChart from '@/components/report/MonthlyLineChart';
import CategoryBarChart from '@/components/report/CategoryBarChart';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * Per-category analysis page.
 * Left sidebar: list of categories with YoY delta.
 * Right panel: overview bar chart OR drill-down (monthly chart + table).
 */
export default function CategoriePage() {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [mode,     setMode]     = useState('annual'); // 'annual' | 'monthly'
  const [type,     setType]     = useState('expense');
  const [paymentGroup, setPaymentGroup] = useState('traditional'); // traditional | alternative | all
  const [compare,  setCompare]  = useState('period'); // 'period' | 'full', conta solo per un periodo in corso
  const t = useTranslations('reports.categories');
  const tCommon = useTranslations('common');
  const tGroups = useTranslations('paymentGroups');
  const { locale, fmt, fmtPct, deltaClass, monthsShort, monthsLong } = useFormat();

  let url = `/api/report/categorie?year=${year}&type=${type}`;
  if (mode === 'monthly') {
    url += `&month=${month}`;
  }
  if (paymentGroup !== 'all') {
    url += `&paymentGroup=${paymentGroup}`;
  }
  const { data, loading, error } = useApiData(`${url}&compare=${compare}`, 'report/categorie');

  // La selezione vale solo per i filtri con cui è stata fatta: cambiando anno, tipo o mese la
  // categoria scelta potrebbe non esistere più nei nuovi dati, quindi decade da sola. La base del
  // confronto non conta: le categorie mostrate restano le stesse.
  const [selection, setSelection] = useState({ url: null, id: null });
  const selected = selection.url === url ? selection.id : null;

  const categories  = data?.categories || [];

  // Periodo in corso: il confronto può essere con lo stesso periodo dell'anno prima o con il
  // periodo intero. Le etichette lo dicono sempre, così nessun numero resta ambiguo.
  // Gli anni passano come stringhe: un numero nel messaggio verrebbe scritto "2,026" in inglese.
  const monthInText = (index) => (locale === 'it' ? monthsLong[index].toLowerCase() : monthsLong[index]);
  const cutoff     = data?.cutoff ?? null;
  const cutoffDay  = cutoff ? `${Number(cutoff.slice(8))} ${monthInText(Number(cutoff.slice(5, 7)) - 1)}` : '';
  const monthName  = monthsLong[month - 1];
  const periodName = mode === 'annual' ? String(year) : `${monthName} ${year}`;
  const prevName   = mode === 'annual' ? String(year - 1) : `${monthName} ${year - 1}`;
  let subtitle = t('compare', { period: periodName, prev: prevName });
  if (cutoff && mode === 'annual') {
    subtitle = t(compare === 'period' ? 'yearToDatePeriod' : 'yearToDateFull',
      { year: String(year), day: cutoffDay, prevYear: String(year - 1) });
  } else if (cutoff) {
    subtitle = t(compare === 'period' ? 'monthToDatePeriod' : 'monthToDateFull', {
      month: monthName, year: String(year), day: cutoffDay,
      monthLower: monthInText(month - 1), prevYear: String(year - 1),
    });
  }
  const prevLabel  = !cutoff ? prevName : t(compare === 'period' ? 'prevSamePeriod' : 'prevWhole', { prev: prevName });
  const selectedCat = selected ? categories.find(c => c.categoryId === selected) : null;

  /** Toggles the selected category; clicking the same one deselects it. */
  const handleSelect = useCallback(
    (id) => setSelection(prev => ({ url, id: prev.url === url && prev.id === id ? null : id })),
    [url],
  );

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-base-content/50">{subtitle}</p>
        </div>
      </div>

      {/* ── Filtri ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select className="select select-bordered select-sm" value={year}
          onChange={e => setYear(parseInt(e.target.value))} aria-label={tCommon('year')}>
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {mode === 'monthly' && (
          <select className="select select-bordered select-sm" value={month}
            onChange={e => setMonth(parseInt(e.target.value))} aria-label={tCommon('month')}>
            {monthsShort.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        )}

        <div className="tabs tabs-boxed">
          {[['expense', tCommon('expenses')], ['income', tCommon('income')]].map(([v, l]) => (
            <button key={v} className={`tab tab-sm ${type === v ? 'tab-active' : ''}`}
              onClick={() => setType(v)}>{l}</button>
          ))}
        </div>

        <select
          className="select select-bordered select-sm"
          value={paymentGroup}
          onChange={e => setPaymentGroup(e.target.value)}
          aria-label={tGroups('label')}
        >
          <option value="traditional">{tGroups('traditional')}</option>
          <option value="alternative">{tGroups('alternative')}</option>
          <option value="all">{tGroups('all')}</option>
        </select>

        {cutoff && (
          <div className="tabs tabs-boxed" role="group" aria-label={t('comparisonBasis')}>
            {[['period', t('samePeriod')], ['full', mode === 'monthly' ? t('fullMonth') : t('fullYear')]].map(([v, l]) => (
              <button key={v} className={`tab tab-sm ${compare === v ? 'tab-active' : ''}`}
                onClick={() => setCompare(v)}>{l}</button>
            ))}
          </div>
        )}

        <div className="ml-auto tabs tabs-boxed">
          {[['annual', t('yearly')], ['monthly', t('monthly')]].map(([v, l]) => (
            <button key={v} className={`tab tab-sm ${mode === v ? 'tab-active' : ''}`}
              onClick={() => setMode(v)}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : error ? (
        <div className="alert alert-warning"><span>{tCommon('loadError')}</span></div>
      ) : !categories.length ? (
        <div className="text-center py-16 text-base-content/40">
          <p className="text-4xl mb-2">{'📂'}</p>
          <p>{tCommon('noDataForYear', { year: String(year) })}</p>
        </div>
      ) : (
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">

          {/* ── Category sidebar ──────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body p-3">
                <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2 px-1">
                  {t('listTitle', { period: mode === 'annual' ? String(year) : `${monthsShort[month - 1]} ${year}` })}
                </h2>
                <ul className="space-y-0.5 max-h-64 lg:max-h-none overflow-y-auto">
                  {categories.map(cat => (
                    <li key={cat.categoryId}>
                      <button
                        className={`w-full flex items-center justify-between px-2 py-2.5 rounded-lg text-sm transition-colors
                          ${selected === cat.categoryId
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-base-200'}`}
                        onClick={() => handleSelect(cat.categoryId)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }} />
                          <span className="truncate">{cat.categoryName}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="font-medium">{fmt(cat.totalCur)}</span>
                          {cat.deltaPct !== null && (
                            <span className={`text-xs ${deltaClass(cat.deltaPct, type)}`}>
                              {fmtPct(cat.deltaPct)}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── Detail panel ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {selectedCat ? (
              <>
                {/* KPI cards */}
                <div className="card bg-base-100 border border-base-200 shadow-sm">
                  <div className="card-body p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedCat.color }} />
                      <h2 className="text-lg font-bold">{selectedCat.categoryName}</h2>
                    </div>
                    {(() => {
                      const delta = `${selectedCat.deltaAbs >= 0 ? '+' : ''}${fmt(selectedCat.deltaAbs)}`
                        + (selectedCat.deltaPct !== null ? ` (${fmtPct(selectedCat.deltaPct)})` : '');
                      const boxes = [
                        { label: cutoff ? t('periodToDay', { period: periodName, day: cutoffDay }) : periodName, val: fmt(selectedCat.totalCur), cls: '' },
                        ...(cutoff
                          ? [
                              { label: t('prevSamePeriod', { prev: prevName }), val: fmt(selectedCat.totalPrevToDate), cls: 'text-base-content/60' },
                              { label: t('prevWhole', { prev: prevName }), val: fmt(selectedCat.totalPrevFull), cls: 'text-base-content/60' },
                            ]
                          : [{ label: prevName, val: fmt(selectedCat.totalPrev), cls: 'text-base-content/60' }]),
                        { label: !cutoff ? tCommon('change') : compare === 'period' ? t('changeSamePeriod') : t('changeFullPeriod'), val: delta, cls: deltaClass(selectedCat.deltaAbs, type) },
                        ...(mode === 'annual' ? [{ label: tCommon('avgPerMonth'), val: fmt(selectedCat.avg), cls: '' }] : []),
                      ];
                      return (
                        <div className={`grid grid-cols-2 gap-3 ${boxes.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                          {boxes.map(s => (
                            <div key={s.label} className="bg-base-200 rounded-lg p-3">
                              <p className="text-xs text-base-content/50 mb-1">{s.label}</p>
                              <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Monthly line chart — only in annual mode */}
                {mode === 'annual' && (
                  <div className="card bg-base-100 border border-base-200 shadow-sm">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-semibold text-base-content/60 mb-3">{t('monthlyTrend')}</h3>
                      <MonthlyLineChart
                        data={selectedCat.monthly}
                        color={selectedCat.color}
                        year={year}
                        prevYear={year - 1}
                      />
                      {cutoff && (
                        <p className="text-xs text-base-content/40 mt-2">
                          {t('inProgress', { month: monthsLong[Number(cutoff.slice(5, 7)) - 1] })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Monthly breakdown table — only in annual mode */}
                {mode === 'annual' && (
                  <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="table table-xs text-xs">
                        <thead>
                          <tr className="bg-base-200">
                            <th>{tCommon('month')}</th>
                            <th className="text-right">{year}</th>
                            <th className="text-right text-base-content/50">{year - 1}</th>
                            <th className="text-right">{t('absoluteDelta')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCat.monthly.map(m => {
                            const future   = m.cur === null;
                            // Mese in corso: con "stesso periodo" si confronta con gli stessi giorni dell'anno prima.
                            const prev     = m.partial && compare === 'period' ? m.prevToDate : m.prev;
                            const delta    = future ? 0 : m.cur - prev;
                            const hasDelta = !future && (prev > 0 || m.cur > 0);
                            return (
                              <tr key={m.month} className="hover">
                                <td className="font-medium">{monthsShort[m.month - 1]}{m.partial ? ` ${t('toDay', { day: Number(cutoff.slice(8)) })}` : ''}</td>
                                <td className="text-right">{m.cur > 0 ? fmt(m.cur) : '—'}</td>
                                <td className="text-right text-base-content/50">{prev > 0 ? fmt(prev) : '—'}</td>
                                <td className={`text-right ${hasDelta && delta !== 0 ? deltaClass(delta, type) : 'text-base-content/30'}`}>
                                  {hasDelta && delta !== 0 ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Overview: bar chart all categories */
              <div className="card bg-base-100 border border-base-200 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="text-sm font-semibold text-base-content/60 mb-1">
                    {t('topTitle', { period: periodName, prev: prevLabel })}
                  </h3>
                  <p className="text-xs text-base-content/40 mb-3">
                    {t('tapHint')}
                  </p>
                  <CategoryBarChart
                    data={categories.map(c => ({
                      categoryName: c.categoryName,
                      color:        c.color,
                      totalCur:     c.totalCur,
                      totalPrev:    c.totalPrev,
                    }))}
                    showPrev={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
