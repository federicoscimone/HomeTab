/**
 * @fileoverview Main dashboard page — monthly financial overview.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatCard from '@/components/dashboard/StatCard';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import TrendChart from '@/components/dashboard/TrendChart';
import PaymentGroupBar from '@/components/dashboard/PaymentGroupBar';
import { getPaymentMethod } from '@/lib/utils/payments';
import { fmtFull, MONTHS_FULL } from '@/lib/utils/format';

/**
 * Dashboard page — renders a monthly snapshot with stat cards, charts,
 * payment method breakdown, and a 6-month trend.
 */
export default function DashboardPage() {
  const now = new Date();
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [year,    setYear]    = useState(now.getFullYear());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/dashboard?year=${year}&month=${month}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => {
        console.error('[dashboard] Fetch error:', err);
        setError(true);
        setLoading(false);
      });
  }, [month, year]);

  /** Navigate to the previous calendar month. */
  const prevMonth = useCallback(() => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }, [month]);

  /** Navigate to the next calendar month (disabled when on current month). */
  const nextMonth = useCallback(() => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }, [month]);

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const balance = (data?.current.totalIncome || 0) - (data?.current.totalExpense || 0);

  /** Zero-padded month string for URL params, e.g. "03". */
  const mm = String(month).padStart(2, '0');

  return (
    <div className="flex flex-col gap-4 sm:gap-6">

      {/* ── Header + month navigator ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-base-content/50">Panoramica finanziaria mensile</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="btn btn-ghost btn-sm" onClick={prevMonth} aria-label="Mese precedente">‹</button>
          <span className="font-semibold text-sm sm:text-base min-w-[120px] sm:min-w-[140px] text-center">
            {MONTHS_FULL[month - 1]} {year}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={nextMonth}
            disabled={isCurrentMonth}
            aria-label="Mese successivo"
          >›</button>
          {!isCurrentMonth && (
            <button
              className="btn btn-ghost btn-xs text-base-content/40"
              onClick={() => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()); }}
            >
              Oggi
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : error ? (
        <div className="alert alert-warning">
          <span>Errore nel caricamento dei dati. Riprova.</span>
        </div>
      ) : (
        <>
          {/* ── Stat cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Uscite"
              value={data.current.totalExpense}
              prevValue={data.previous.totalExpense}
              color="text-error"
            />
            <StatCard
              title="Entrate"
              value={data.current.totalIncome}
              prevValue={data.previous.totalIncome}
              color="text-success"
            />
            <div className="stat bg-base-100 rounded-xl border border-base-200 shadow-sm col-span-1">
              <div className="stat-title text-xs">Saldo</div>
              <div className={`stat-value text-xl sm:text-2xl ${balance >= 0 ? 'text-success' : 'text-error'}`}>
                {fmtFull(balance)}
              </div>
              <div className="stat-desc text-xs mt-1 text-base-content/40">Entrate − Uscite</div>
            </div>
            <div className="stat bg-base-100 rounded-xl border border-base-200 shadow-sm col-span-1">
              <div className="stat-title text-xs">Movimenti</div>
              <div className="stat-value text-xl sm:text-2xl">{data.current.count}</div>
              <div className="stat-desc text-xs mt-1">
                <Link
                  href={`/movimenti?from=${year}-${mm}-01&to=${year}-${mm}-31`}
                  className="text-primary hover:underline"
                >
                  Vedi tutti →
                </Link>
              </div>
            </div>
          </div>

          {/* ── Pie charts ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body py-4">
                <h2 className="font-semibold text-sm">Uscite per categoria</h2>
                <CategoryPieChart data={data.byCategory} />
              </div>
            </div>
            <div className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body py-4">
                <h2 className="font-semibold text-sm">Entrate per categoria</h2>
                <CategoryPieChart data={data.byIncomeCategory} />
              </div>
            </div>
          </div>

          {/* ── 6-month trend ─────────────────────────────────────────── */}
          <div className="card bg-base-100 border border-base-200 shadow-sm">
            <div className="card-body py-4">
              <h2 className="font-semibold text-sm">Andamento ultimi 6 mesi</h2>
              <TrendChart data={data.trend} />
            </div>
          </div>

          {/* ── Payment breakdown ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* By method */}
            <div className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body py-4">
                <h2 className="font-semibold text-sm mb-3">Uscite per metodo di pagamento</h2>
                {data.byMethod.length === 0 ? (
                  <p className="text-sm text-base-content/30">Nessun dato</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.byMethod.map((m, i) => {
                      const pm  = getPaymentMethod(m.method);
                      const pct = data.current.totalExpense > 0
                        ? (m.amount / data.current.totalExpense) * 100
                        : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs w-24 sm:w-28 truncate">{pm?.label || m.method}</span>
                          <div className="flex-1 bg-base-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs w-16 sm:w-20 text-right font-medium">
                            {fmtFull(m.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Traditional vs alternative + top categories */}
            <div className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body py-4">
                <h2 className="font-semibold text-sm mb-3">Tradizionale vs Alternativo</h2>
                <PaymentGroupBar
                  traditional={data.paymentGroups.traditional}
                  alternative={data.paymentGroups.alternative}
                />
                {data.byCategory.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-base-content/50 mb-2">Uscite per categoria</p>
                    <div className="flex flex-col gap-2">
                      {data.byCategory.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: c.color }} />
                            <span className="text-xs flex-1 truncate font-medium">{c.name}</span>
                            <span className="text-xs font-medium">{fmtFull(c.amount)}</span>
                          </div>
                          {(c.traditional > 0 || c.alternative > 0) && (
                            <div className="flex gap-2 pl-4.5">
                              {c.traditional > 0 && (
                                <span className="text-[10px] text-info">
                                  Trad {fmtFull(c.traditional)}
                                </span>
                              )}
                              {c.alternative > 0 && (
                                <span className="text-[10px] text-warning">
                                  Alt {fmtFull(c.alternative)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
