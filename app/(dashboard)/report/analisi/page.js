/**
 * @fileoverview Advanced analysis page — custom date range, YoY comparison, projections.
 */

'use client';

import { useState, useCallback } from 'react';
import { useApiData } from '@/lib/hooks/useApiData';
import CategoryBarChart from '@/components/report/CategoryBarChart';
import { fmt, fmtFull, fmtPct, deltaClass } from '@/lib/utils/format';

/**
 * @returns {string} Today as YYYY-MM-DD.
 */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * @returns {string} January 1st of the current year as YYYY-MM-DD.
 */
function firstDayOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

/**
 * Dynamically imports xlsx and triggers an Excel download of the category comparison.
 *
 * @param {object} data - API response from /api/report/analisi.
 * @param {string} from - Start date.
 * @param {string} to   - End date.
 * @param {string} type - 'expense' | 'income'.
 */
async function exportExcel(data, from, to, type) {
  const xlsxMod = await import('xlsx');
  const XLSX = xlsxMod.default ?? xlsxMod;
  const rows = [
    ['Categoria', `${from} → ${to}`, `${data.prevFrom} → ${data.prevTo}`, 'Δ', 'Δ%'],
    ...data.byCategory.map(c => [c.name, c.cur, c.prev, c.delta, c.pct != null ? c.pct / 100 : '']),
    [],
    ['TOTALE', data.totalCur, data.totalPrev, data.deltaAbs, data.deltaPct != null ? data.deltaPct / 100 : ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Analisi');
  XLSX.writeFile(wb, `hometab-analisi-${from}-${to}-${type}.xlsx`);
}

/**
 * Advanced analysis page with custom date range, YoY delta table,
 * category comparison chart, year-end projection, and weekly breakdown.
 */
export default function AnalisiPage() {
  const [from,    setFrom]    = useState(firstDayOfYear());
  const [to,      setTo]      = useState(todayStr());
  const [type,    setType]    = useState('expense');
  const [paymentGroup, setPaymentGroup] = useState('traditional'); // traditional | alternative | all

  // Con una delle due date vuote non si carica nulla; «Analizza» ripete la richiesta corrente.
  const query = new URLSearchParams({ from, to, type });
  if (paymentGroup !== 'all') {
    query.set('paymentGroup', paymentGroup);
  }
  const { data, loading, error, reload: fetchData } = useApiData(
    from && to ? `/api/report/analisi?${query}` : null,
    'report/analisi',
  );

  const handleExport = useCallback(() => {
    if (!data) return;
    exportExcel(data, from, to, type).catch(err => {
      console.error('[report/analisi] export error:', err);
      alert('Errore durante l\'esportazione. Controlla la console per dettagli.');
    });
  }, [data, from, to, type]);

  const proj = data?.projection;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Analisi Avanzata</h1>
          <p className="text-sm text-base-content/50">Range personalizzato, confronto YoY, proiezioni</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!data}>
          ↓ Esporta Excel
        </button>
      </div>

      {/* ── Filtri ──────────────────────────────────────────────────── */}
      <div className="card bg-base-100 border border-base-200 shadow-sm mb-5">
        <div className="card-body p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label py-0 mb-1"><span className="label-text text-xs">Dal</span></label>
              <input type="date" className="input input-bordered input-sm"
                value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label py-0 mb-1"><span className="label-text text-xs">Al</span></label>
              <input type="date" className="input input-bordered input-sm"
                value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="tabs tabs-boxed self-end">
              {[['expense', 'Uscite'], ['income', 'Entrate']].map(([v, l]) => (
                <button key={v} className={`tab tab-sm ${type === v ? 'tab-active' : ''}`}
                  onClick={() => setType(v)}>{l}</button>
              ))}
            </div>
            <div>
              <label className="label py-0 mb-1"><span className="label-text text-xs">Metodi pagamento</span></label>
              <select
                className="select select-bordered select-sm"
                value={paymentGroup}
                onChange={e => setPaymentGroup(e.target.value)}
                aria-label="Metodi pagamento"
              >
                <option value="traditional">Tradizionali</option>
                <option value="alternative">Alternativi</option>
                <option value="all">Tutti</option>
              </select>
            </div>
            <button className="btn btn-primary btn-sm self-end" onClick={fetchData} disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'Analizza'}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-warning"><span>Errore nel caricamento. Riprova.</span></div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">

          {/* ── KPI totals ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Periodo selezionato',
                val:   fmtFull(data.totalCur),
                sub:   `${data.from} → ${data.to}`,
                cls:   '',
              },
              {
                label: 'Stesso periodo anno prec.',
                val:   fmtFull(data.totalPrev),
                sub:   `${data.prevFrom} → ${data.prevTo}`,
                cls:   'text-base-content/60',
              },
              {
                label: 'Variazione assoluta',
                val:   `${data.deltaAbs >= 0 ? '+' : ''}${fmtFull(data.deltaAbs)}`,
                sub:   '',
                cls:   deltaClass(data.deltaAbs, type),
              },
              {
                label: 'Variazione %',
                val:   fmtPct(data.deltaPct),
                sub:   '',
                cls:   deltaClass(data.deltaPct, type),
              },
            ].map(s => (
              <div key={s.label} className="card bg-base-100 border border-base-200 shadow-sm">
                <div className="card-body p-3 sm:p-4">
                  <p className="text-xs text-base-content/50 mb-1 leading-tight">{s.label}</p>
                  <p className={`text-lg sm:text-xl font-bold ${s.cls}`}>{s.val}</p>
                  {s.sub && <p className="text-xs text-base-content/40 mt-1">{s.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* ── Year projection (expense only) ────────────────────── */}
          {type === 'expense' && proj && (
            <div className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="text-sm font-semibold text-base-content/60 mb-3">
                  Proiezione Fine Anno {new Date().getFullYear()}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Speso finora',       val: fmt(proj.yearTotal),   sub: `${proj.monthsElapsed} mesi` },
                    { label: 'Media/mese',          val: fmt(proj.avgPerMonth), sub: '' },
                    { label: 'Proiezione annuale',  val: fmt(proj.projection),  sub: 'su base lineare', primary: true },
                    { label: 'Stima rimanente',     val: fmt(proj.remaining),   sub: `${proj.monthsRemaining} mesi rimasti` },
                  ].map(s => (
                    <div key={s.label}
                      className={`rounded-lg p-3 ${s.primary ? 'bg-primary/10 border border-primary/20' : 'bg-base-200'}`}>
                      <p className="text-xs text-base-content/50 mb-1">{s.label}</p>
                      <p className={`text-lg font-bold ${s.primary ? 'text-primary' : ''}`}>{s.val}</p>
                      {s.sub && <p className="text-xs text-base-content/40">{s.sub}</p>}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-xs text-base-content/50 mb-1">
                    <span>Avanzamento ({Math.round((proj.monthsElapsed / 12) * 100)}%)</span>
                    <span>{fmt(proj.yearTotal)} / {fmt(proj.projection)}</span>
                  </div>
                  <progress className="progress progress-primary w-full"
                    value={proj.yearTotal} max={proj.projection} />
                </div>
              </div>
            </div>
          )}

          {/* ── Category comparison chart ─────────────────────────── */}
          {data.byCategory?.length > 0 && (
            <div className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="text-sm font-semibold text-base-content/60 mb-3">
                  Confronto per Categoria
                </h3>
                <CategoryBarChart
                  data={data.byCategory.map(c => ({
                    categoryName: c.name,
                    color:        c.color,
                    totalCur:     c.cur,
                    totalPrev:    c.prev,
                  }))}
                  showPrev={true}
                />
              </div>
            </div>
          )}

          {/* ── Category delta table ──────────────────────────────── */}
          {data.byCategory?.length > 0 && (
            <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-xs text-xs">
                  <thead>
                    <tr className="bg-base-200">
                      <th>Categoria</th>
                      <th className="text-right">Periodo sel.</th>
                      <th className="text-right text-base-content/50">Anno prec.</th>
                      <th className="text-right">Δ</th>
                      <th className="text-right">Δ%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCategory.map(c => (
                      <tr key={c.id} className="hover">
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: c.color }} />
                            {c.name}
                          </div>
                        </td>
                        <td className="text-right font-medium">{fmt(c.cur)}</td>
                        <td className="text-right text-base-content/50">{c.prev > 0 ? fmt(c.prev) : '—'}</td>
                        <td className={`text-right ${c.delta !== 0 ? deltaClass(c.delta, type) : 'text-base-content/30'}`}>
                          {c.delta !== 0 ? `${c.delta > 0 ? '+' : ''}${fmt(c.delta)}` : '—'}
                        </td>
                        <td className={`text-right ${c.pct != null ? deltaClass(c.pct, type) : 'text-base-content/30'}`}>
                          {fmtPct(c.pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-base-200 font-bold">
                      <td>TOTALE</td>
                      <td className="text-right">{fmt(data.totalCur)}</td>
                      <td className="text-right text-base-content/50">{fmt(data.totalPrev)}</td>
                      <td className={`text-right ${deltaClass(data.deltaAbs, type)}`}>
                        {data.deltaAbs >= 0 ? '+' : ''}{fmt(data.deltaAbs)}
                      </td>
                      <td className={`text-right ${deltaClass(data.deltaPct, type)}`}>
                        {fmtPct(data.deltaPct)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Weekly breakdown ──────────────────────────────────── */}
          {data.weekly?.length > 0 && (
            <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
              <div className="card-body p-4">
                <h3 className="text-sm font-semibold text-base-content/60 mb-3">Andamento Settimanale</h3>
                <div className="overflow-x-auto">
                  <table className="table table-xs text-xs">
                    <thead>
                      <tr className="bg-base-200">
                        <th>Settimana</th>
                        <th className="text-right">Importo</th>
                        <th className="hidden sm:table-cell">Barra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const maxAmt = Math.max(...data.weekly.map(w => w.amount), 1);
                        return data.weekly.map(w => (
                          <tr key={w.week} className="hover">
                            <td className="font-medium">{w.week}</td>
                            <td className="text-right">{fmtFull(w.amount)}</td>
                            <td className="hidden sm:table-cell w-40">
                              <div className="bg-primary/20 rounded h-2"
                                style={{ width: `${(w.amount / maxAmt) * 100}%`, minWidth: '4px' }} />
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !data && !error && (
        <div className="text-center py-16 text-base-content/40">
          <p className="text-4xl mb-2">🔍</p>
          <p>Seleziona un periodo e clicca Analizza</p>
        </div>
      )}
    </div>
  );
}
