/**
 * @fileoverview Per-category report — monthly trend and YoY comparison.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import MonthlyLineChart from '@/components/report/MonthlyLineChart';
import CategoryBarChart from '@/components/report/CategoryBarChart';
import { fmt, fmtPct, deltaClass, MONTHS_SHORT } from '@/lib/utils/format';

const MONTHS = MONTHS_SHORT.slice(1); // ['Gen', ...]

/**
 * Per-category analysis page.
 * Left sidebar: list of categories with YoY delta.
 * Right panel: overview bar chart OR drill-down (monthly chart + table).
 */
export default function CategoriePage() {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [type,     setType]     = useState('expense');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setSelected(null);
    fetch(`/api/report/categorie?year=${year}&type=${type}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d  => { setData(d); setLoading(false); })
      .catch(err => {
        console.error('[report/categorie] fetch error:', err);
        setError(true);
        setLoading(false);
      });
  }, [year, type]);

  const categories  = data?.categories || [];
  const selectedCat = selected ? categories.find(c => c.categoryId === selected) : null;

  /** Toggles the selected category; clicking the same one deselects it. */
  const handleSelect = useCallback(
    (id) => setSelected(prev => (prev === id ? null : id)),
    [],
  );

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Analisi per Categoria</h1>
          <p className="text-sm text-base-content/50">Confronto anno corrente vs anno precedente</p>
        </div>
      </div>

      {/* ── Filtri ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select className="select select-bordered select-sm" value={year}
          onChange={e => setYear(parseInt(e.target.value))} aria-label="Anno">
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div className="tabs tabs-boxed">
          {[['expense', 'Uscite'], ['income', 'Entrate']].map(([v, l]) => (
            <button key={v} className={`tab tab-sm ${type === v ? 'tab-active' : ''}`}
              onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : error ? (
        <div className="alert alert-warning"><span>Errore nel caricamento. Riprova.</span></div>
      ) : !categories.length ? (
        <div className="text-center py-16 text-base-content/40">
          <p className="text-4xl mb-2">📂</p>
          <p>Nessun dato per {year}</p>
        </div>
      ) : (
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">

          {/* ── Category sidebar ──────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body p-3">
                <h2 className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2 px-1">
                  Categorie {year}
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: String(year),     val: fmt(selectedCat.totalCur), cls: '' },
                        { label: String(year - 1), val: fmt(selectedCat.totalPrev), cls: 'text-base-content/60' },
                        {
                          label: 'Variazione',
                          val: `${selectedCat.deltaAbs >= 0 ? '+' : ''}${fmt(selectedCat.deltaAbs)}`,
                          cls: deltaClass(selectedCat.deltaAbs, type),
                        },
                        { label: 'Media/mese', val: fmt(selectedCat.avg), cls: '' },
                      ].map(s => (
                        <div key={s.label} className="bg-base-200 rounded-lg p-3">
                          <p className="text-xs text-base-content/50 mb-1">{s.label}</p>
                          <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Monthly line chart */}
                <div className="card bg-base-100 border border-base-200 shadow-sm">
                  <div className="card-body p-4">
                    <h3 className="text-sm font-semibold text-base-content/60 mb-3">Andamento Mensile</h3>
                    <MonthlyLineChart
                      data={selectedCat.monthly}
                      color={selectedCat.color}
                      year={year}
                      prevYear={year - 1}
                    />
                  </div>
                </div>

                {/* Monthly breakdown table */}
                <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table table-xs text-xs">
                      <thead>
                        <tr className="bg-base-200">
                          <th>Mese</th>
                          <th className="text-right">{year}</th>
                          <th className="text-right text-base-content/50">{year - 1}</th>
                          <th className="text-right">Δ assoluto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCat.monthly.map(m => {
                          const delta    = m.cur - m.prev;
                          const hasDelta = m.prev > 0 || m.cur > 0;
                          return (
                            <tr key={m.month} className="hover">
                              <td className="font-medium">{MONTHS[m.month - 1]}</td>
                              <td className="text-right">{m.cur > 0 ? fmt(m.cur) : '—'}</td>
                              <td className="text-right text-base-content/50">{m.prev > 0 ? fmt(m.prev) : '—'}</td>
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
              </>
            ) : (
              /* Overview: bar chart all categories */
              <div className="card bg-base-100 border border-base-200 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="text-sm font-semibold text-base-content/60 mb-1">
                    Top Categorie — {year} vs {year - 1}
                  </h3>
                  <p className="text-xs text-base-content/40 mb-3">
                    Tocca una categoria nella lista per il dettaglio mensile
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
