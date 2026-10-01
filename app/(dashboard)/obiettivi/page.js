/**
 * @fileoverview Obiettivi — elenco degli obiettivi di risparmio con avanzamento e proiezione.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import GoalStateBadge from '@/components/obiettivi/GoalStateBadge';
import GoalFormModal from '@/components/obiettivi/GoalFormModal';
import AllocationModal from '@/components/obiettivi/AllocationModal';
import { fmt, fmtMonth } from '@/lib/utils/format';
import useCan from '@/lib/auth/useCan';

/**
 * Card di un obiettivo attivo.
 *
 * @param {{ goal: object }} props
 */
function GoalCard({ goal }) {
  const p = goal.projection;
  return (
    <Link
      href={`/obiettivi/${goal.id}`}
      className="card bg-base-100 border border-base-200 shadow-sm hover:border-primary/40 transition-colors"
    >
      <div className="card-body p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{goal.name}</h3>
            <p className="text-xs text-base-content/50">entro {fmtMonth(goal.deadline)}</p>
          </div>
          <GoalStateBadge state={goal.state} />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-bold">{fmt(goal.saved) === '—' ? '€0' : fmt(goal.saved)}</span>
            <span className="text-base-content/50">di {fmt(goal.targetAmount)}</span>
          </div>
          <progress
            className={`progress w-full ${goal.state === 'behind' || goal.state === 'expired' ? 'progress-warning' : 'progress-primary'}`}
            value={goal.progress * 100} max={100}
            aria-label={`Avanzamento ${Math.round(goal.progress * 100)}%`}
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-base-content/50">Quota attuale</dt>
          <dd className="text-right">
            {goal.pct != null ? `${goal.pct}%${p?.expectedQuota != null ? ` ≈ ${fmt(p.expectedQuota)}/mese` : ''}` : '—'}
          </dd>
          {goal.state !== 'reached' && (
            <>
              <dt className="text-base-content/50">Servono</dt>
              <dd className="text-right">{p?.requiredMonthly != null ? `${fmt(p.requiredMonthly)}/mese` : '—'}</dd>
              <dt className="text-base-content/50">Stima arrivo</dt>
              <dd className="text-right">{fmtMonth(p?.reachMonth)}</dd>
            </>
          )}
          {goal.spent > 0 && (
            <>
              <dt className="text-base-content/50">Già speso</dt>
              <dd className="text-right">{fmt(goal.spent)}</dd>
            </>
          )}
        </dl>
      </div>
    </Link>
  );
}

export default function ObiettiviPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const canManage = useCan()('goals:manage');

  const load = useCallback(() => {
    return fetch('/api/obiettivi')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setError(false); setLoading(false); })
      .catch((err) => {
        console.error('[obiettivi] fetch error:', err);
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = data?.goals.filter((g) => g.status === 'active') ?? [];
  const closed = data?.goals.filter((g) => g.status !== 'active') ?? [];
  // Obiettivi chiusi ancora presenti nel piano: la loro quota ora finisce nel libero.
  const idleShares = data?.plan?.shares
    .filter((s) => s.pct > 0 && closed.some((g) => g.id === s.goalId))
    .map((s) => ({ ...s, name: closed.find((g) => g.id === s.goalId).name })) ?? [];
  const forced = !!data?.planNeedsUpdate;
  const assignedPct = data?.plan?.shares
    .filter((s) => active.some((g) => g.id === s.goalId))
    .reduce((sum, s) => sum + s.pct, 0) ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Obiettivi</h1>
          <p className="text-sm text-base-content/50">
            Il risparmio dei mesi chiusi, diviso tra ciò che vuoi acquistare
          </p>
        </div>
        {canManage && (
        <div className="flex gap-2">
          {active.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => setShowPlan(true)}>Ripartizione</button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nuovo obiettivo</button>
        </div>
        )}
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
          {/* ── KPI ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Risparmio medio',
                val: data.avgSavings != null ? `${fmt(data.avgSavings)}/mese` : '—',
                sub: data.avgMonths ? `ultimi ${data.avgMonths} mesi chiusi` : 'nessun mese chiuso',
                cls: data.avgSavings < 0 ? 'text-error' : '',
              },
              {
                label: `${fmtMonth(data.currentMonth)} (in corso)`,
                val: fmt(data.currentMonthSavings) === '—' ? '€0' : fmt(data.currentMonthSavings),
                sub: 'provvisorio, si ripartisce a fine mese',
                cls: data.currentMonthSavings < 0 ? 'text-error' : '',
              },
              {
                label: 'Servono per tutti',
                val: data.totalRequired > 0 ? `${fmt(data.totalRequired)}/mese` : '—',
                sub: 'per arrivare in tempo',
                cls: data.feasible === false ? 'text-warning' : '',
              },
              {
                label: 'Risparmio libero',
                val: fmt(data.free) === '—' ? '€0' : fmt(data.free),
                sub: `${100 - assignedPct}% del risparmio non assegnato`,
                cls: data.free < 0 ? 'text-error' : '',
              },
            ].map((s) => (
              <div key={s.label} className="card bg-base-100 border border-base-200 shadow-sm">
                <div className="card-body p-3 sm:p-4">
                  <p className="text-xs text-base-content/50 mb-1 leading-tight">{s.label}</p>
                  <p className={`text-lg sm:text-xl font-bold ${s.cls}`}>{s.val}</p>
                  <p className="text-xs text-base-content/40 mt-1">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-base-content/50">
            Risparmio = entrate − uscite con metodi di pagamento tradizionali. Ticket e buoni non contano, e nemmeno i
            movimenti esclusi dalle analisi (es. giroconti verso il conto deposito).
          </p>

          {data.feasible === false && (
            <div className="alert alert-warning text-sm">
              <span>
                Per arrivare in tempo su tutti gli obiettivi servono {fmt(data.totalRequired)} al mese, ma ne risparmi in
                media {fmt(data.avgSavings)}. Sposta una scadenza, riduci un importo o rivedi le spese.
              </span>
            </div>
          )}

          {forced && !canManage && (
            <div className="alert alert-info text-sm">
              <span>Ci sono obiettivi senza percentuale di risparmio: un amministratore deve scegliere la ripartizione.</span>
            </div>
          )}

          {idleShares.length > 0 && (
            <div className="alert text-sm">
              <span>
                {idleShares.map((s) => `${s.name} (${s.pct}%)`).join(', ')} {idleShares.length > 1 ? 'sono chiusi' : 'è chiuso'}:
                la quota ora va nel risparmio libero.
              </span>
              {canManage && <button className="btn btn-sm" onClick={() => setShowPlan(true)}>Ridistribuisci</button>}
            </div>
          )}

          {/* ── Attivi ─────────────────────────────────────────────── */}
          {active.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {active.map((g) => <GoalCard key={g.id} goal={g} />)}
            </div>
          ) : (
            <div className="text-center py-12 text-base-content/50">
              <p className="mb-3">Nessun obiettivo attivo.</p>
              {canManage && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>Crea il primo obiettivo</button>
              )}
            </div>
          )}

          {/* ── Chiusi ─────────────────────────────────────────────── */}
          {closed.length > 0 && (
            <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
              <div className="card-body p-4">
                <h3 className="text-sm font-semibold text-base-content/60 mb-2">Conclusi e annullati</h3>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Obiettivo</th>
                        <th>Stato</th>
                        <th className="text-right">Accantonato</th>
                        <th className="text-right">Speso</th>
                        <th className="text-right hidden sm:table-cell">Chiuso a</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closed.map((g) => (
                        <tr key={g.id} className="hover">
                          <td><Link href={`/obiettivi/${g.id}`} className="link link-hover">{g.name}</Link></td>
                          <td><GoalStateBadge state={g.state} /></td>
                          <td className="text-right">{fmt(g.saved)}</td>
                          <td className="text-right">{fmt(g.spent)}</td>
                          <td className="text-right hidden sm:table-cell">{fmtMonth(g.closedMonth)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <GoalFormModal
          minMonth={data?.currentMonth}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {/* Si apre da sola, e non si chiude, finché un obiettivo attivo non ha una percentuale. */}
      {data && canManage && !showForm && (forced || showPlan) && (
        <AllocationModal
          key={data.plan?.effectiveFrom + JSON.stringify(data.missingFromPlan)}
          overview={data}
          forced={forced}
          onClose={() => setShowPlan(false)}
          onSaved={() => { setShowPlan(false); load(); }}
        />
      )}
    </div>
  );
}
