/**
 * @fileoverview Dettaglio obiettivo — andamento, proiezione, quote mensili e spese collegate.
 */

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GoalChart from '@/components/obiettivi/GoalChart';
import GoalStateBadge, { GOAL_STATES } from '@/components/obiettivi/GoalStateBadge';
import GoalFormModal from '@/components/obiettivi/GoalFormModal';
import { getPaymentMethod } from '@/lib/utils/payments';
import { fmt, fmtFull, fmtMonth } from '@/lib/utils/format';
import useCan from '@/lib/auth/useCan';

/** @param {string} d - YYYY-MM-DD */
const formatDate = (d) => d.split('-').reverse().join('/');

/**
 * Conferma di chiusura: "concludi" restituisce l'avanzo al libero, "annulla" permette di
 * girare il disponibile a un altro obiettivo attivo.
 */
function CloseModal({ mode, goal, otherGoals, onConfirm, onClose }) {
  const [transferTo, setTransferTo] = useState('');
  const [saving, setSaving] = useState(false);
  const isComplete = mode === 'complete';

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-md">
        <h3 className="font-bold text-lg">{isComplete ? 'Concludi obiettivo' : 'Annulla obiettivo'}</h3>
        <div className="py-4 text-sm space-y-2">
          {isComplete ? (
            <p>
              Segna <strong>{goal.name}</strong> come acquistato. Smette di ricevere quote e il disponibile
              ({fmtFull(goal.available)}) torna nel risparmio libero
              {goal.available < 0 ? ': essendo negativo, la spesa eccedente viene coperta dal libero' : ''}.
            </p>
          ) : (
            <>
              <p>
                <strong>{goal.name}</strong> smette di ricevere quote. Il disponibile ({fmtFull(goal.available)}) va:
              </p>
              <select
                className="select select-bordered select-sm w-full"
                value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
                aria-label="Destinazione del disponibile"
              >
                <option value="">nel risparmio libero</option>
                {otherGoals.map((g) => <option key={g.id} value={g.id}>a «{g.name}»</option>)}
              </select>
            </>
          )}
          <p className="text-xs text-base-content/50">Potrai riaprirlo in seguito.</p>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Indietro</button>
          <button
            className={`btn btn-sm ${isComplete ? 'btn-primary' : 'btn-warning'}`}
            disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm({ action: mode, transferTo: transferTo || null }); }}
          >
            {isComplete ? 'Concludi' : 'Annulla obiettivo'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

export default function ObiettivoPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [modal, setModal] = useState(null); // 'edit' | 'complete' | 'cancel' | 'delete'
  const canManage = useCan()('goals:manage');

  const load = useCallback(() => {
    return fetch(`/api/obiettivi/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        setData(d);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patch = async (body) => {
    setActionError('');
    const res = await fetch(`/api/obiettivi/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setModal(null);
    if (!res.ok) setActionError(d.error || 'Operazione non riuscita');
    await load();
  };

  const remove = async () => {
    setActionError('');
    const res = await fetch(`/api/obiettivi/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/obiettivi');
      return;
    }
    const d = await res.json();
    setModal(null);
    setActionError(d.error || 'Eliminazione non riuscita');
  };

  if (error) {
    return (
      <div>
        <Link href="/obiettivi" className="btn btn-ghost btn-sm mb-4">← Obiettivi</Link>
        <div className="alert alert-warning"><span>{error}</span></div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const { goal, linkedMovements, currentMonth, avgSavings, avgMonths } = data;
  const p = goal.projection;
  const isActive = goal.status === 'active';
  const canDelete = goal.createdMonth === currentMonth && linkedMovements.length === 0;

  const kpis = [
    { label: 'Accantonato', val: fmtFull(goal.saved), sub: `${Math.round(goal.progress * 100)}% di ${fmt(goal.targetAmount)}`, primary: true },
    { label: 'Disponibile', val: fmtFull(goal.available), sub: goal.spent > 0 ? `già spesi ${fmt(goal.spent)}` : 'nessuna spesa collegata' },
  ];
  if (isActive && p) {
    kpis.push(
      {
        label: 'Quota attuale',
        val: goal.pct != null ? `${goal.pct}%` : '—',
        sub: p.expectedQuota != null ? `≈ ${fmt(p.expectedQuota)}/mese` : 'nessun mese chiuso',
      },
      goal.state === 'reached'
        ? { label: 'Raggiunto', val: fmtMonth(goal.reachedMonth), sub: 'non riceve più quote' }
        : {
          label: 'Servono',
          val: p.requiredMonthly != null ? `${fmt(p.requiredMonthly)}/mese` : '—',
          sub: `per ${p.monthsLeft} mesi, fino a ${fmtMonth(goal.deadline)}`,
        },
    );
  } else {
    kpis.push(
      { label: 'Chiuso a', val: fmtMonth(goal.closedMonth), sub: GOAL_STATES[goal.state]?.label },
      { label: 'Restituito', val: fmtFull(goal.returned), sub: goal.transferTo ? 'a un altro obiettivo' : 'al risparmio libero' },
    );
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4 sm:mb-6">
        <div className="flex items-start gap-2 min-w-0">
          <Link href="/obiettivi" className="btn btn-ghost btn-sm" aria-label="Torna agli obiettivi">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold">{goal.name}</h1>
              <GoalStateBadge state={goal.state} size="md" />
            </div>
            <p className="text-sm text-base-content/50">
              {fmt(goal.targetAmount)} entro {fmtMonth(goal.deadline)} · creato a {fmtMonth(goal.createdMonth)}
              {goal.initialAmount > 0 && ` con ${fmt(goal.initialAmount)} già da parte`}
            </p>
          </div>
        </div>
        {canManage && (
        <div className="flex gap-2 flex-wrap">
          {isActive ? (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModal('edit')}>Modifica</button>
              <button className="btn btn-primary btn-sm" onClick={() => setModal('complete')}>Acquistato</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal('cancel')}>Annulla</button>
            </>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={() => patch({ action: 'reopen' })}>Riapri</button>
          )}
          {canDelete && (
            <button className="btn btn-ghost btn-sm text-error" onClick={() => setModal('delete')}>Elimina</button>
          )}
        </div>
        )}
      </div>

      {actionError && <div className="alert alert-error text-sm py-2 mb-4"><span>{actionError}</span></div>}

      <div className="space-y-4">
        {/* ── KPI ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((s) => (
            <div key={s.label}
              className={`rounded-xl p-3 sm:p-4 border ${s.primary ? 'bg-primary/10 border-primary/20' : 'bg-base-100 border-base-200'}`}>
              <p className="text-xs text-base-content/50 mb-1">{s.label}</p>
              <p className={`text-lg sm:text-xl font-bold ${s.primary ? 'text-primary' : ''}`}>{s.val}</p>
              {s.sub && <p className="text-xs text-base-content/40 mt-1">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Proiezione ────────────────────────────────────────────── */}
        {isActive && p && goal.state !== 'reached' && (
          <div className={`alert text-sm ${goal.state === 'on_track' ? 'alert-success' : goal.state === 'unknown' ? '' : 'alert-warning'}`}>
            <span>
              {goal.state === 'unknown' && 'Serve almeno un mese chiuso e una percentuale assegnata per stimare l\'andamento.'}
              {goal.state === 'expired' && `La scadenza è passata: mancano ${fmt(p.remaining)}. Sposta la scadenza o concludi l'obiettivo.`}
              {(goal.state === 'on_track' || goal.state === 'behind') && (
                <>
                  Con il {goal.pct}% del risparmio medio ({fmt(avgSavings)}/mese, ultimi {avgMonths} mesi) arrivi a{' '}
                  <strong>{fmt(p.projectedAtDeadline)}</strong> entro {fmtMonth(goal.deadline)}
                  {goal.state === 'on_track'
                    ? <>, raggiungendo l&apos;importo verso <strong>{fmtMonth(p.reachMonth)}</strong>.</>
                    : <>: mancherebbero <strong>{fmt(goal.targetAmount - p.projectedAtDeadline)}</strong>
                      {p.reachMonth ? <>. Al ritmo attuale ci arrivi verso <strong>{fmtMonth(p.reachMonth)}</strong>.</> : '.'}</>}
                </>
              )}
            </span>
          </div>
        )}

        <div className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="card-body p-4">
            <h3 className="text-sm font-semibold text-base-content/60 mb-1">Andamento e proiezione</h3>
            <p className="text-xs text-base-content/40 mb-2">
              Linea piena: accantonato a fine mese. Tratteggio: proiezione con la quota attuale.
            </p>
            <GoalChart goal={goal} currentMonth={currentMonth} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── Quote mensili ─────────────────────────────────────────── */}
          <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
            <div className="card-body p-4">
              <h3 className="text-sm font-semibold text-base-content/60 mb-2">Quote mensili</h3>
              {goal.monthly.length === 0 ? (
                <p className="text-sm text-base-content/40">Nessun mese ancora ripartito.</p>
              ) : (
                <div className="overflow-x-auto max-h-80">
                  <table className="table table-xs table-pin-rows">
                    <thead>
                      <tr>
                        <th>Mese</th>
                        <th className="text-right">Risparmio</th>
                        <th className="text-right">%</th>
                        <th className="text-right">Quota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...goal.monthly].reverse().map((m) => (
                        <tr key={m.month} className="hover">
                          <td>{fmtMonth(m.month)}</td>
                          <td className={`text-right ${m.savings < 0 ? 'text-error' : ''}`}>{fmtFull(m.savings)}</td>
                          <td className="text-right">{m.pct}%</td>
                          <td className={`text-right font-medium ${m.quota < 0 ? 'text-error' : ''}`}>{fmtFull(m.quota)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Spese collegate ──────────────────────────────────────── */}
          <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
            <div className="card-body p-4">
              <h3 className="text-sm font-semibold text-base-content/60 mb-1">Spese collegate</h3>
              <p className="text-xs text-base-content/40 mb-2">
                Restano nei report, ma escono dal calcolo del risparmio e scalano il disponibile. Per collegarne una,
                apri il movimento e scegli l&apos;obiettivo.
              </p>
              {linkedMovements.length === 0 ? (
                <p className="text-sm text-base-content/40">Nessuna spesa collegata.</p>
              ) : (
                <div className="overflow-x-auto max-h-80">
                  <table className="table table-xs table-pin-rows">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Descrizione</th>
                        <th className="text-right">Importo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedMovements.map((m) => (
                        <tr key={m._id} className="hover">
                          <td className="whitespace-nowrap">{formatDate(m.date)}</td>
                          <td>
                            <Link href={`/movimenti/${m._id}`} className="link link-hover">
                              {m.payee || m.description || '—'}
                            </Link>
                            <span className="text-base-content/40"> · {getPaymentMethod(m.paymentMethod)?.label}</span>
                          </td>
                          <td className="text-right font-medium">{fmtFull(m.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal === 'edit' && (
        <GoalFormModal
          initial={goal}
          minMonth={currentMonth}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {(modal === 'complete' || modal === 'cancel') && (
        <CloseModal
          mode={modal} goal={goal} otherGoals={data.otherActiveGoals}
          onConfirm={patch} onClose={() => setModal(null)}
        />
      )}
      {modal === 'delete' && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-md">
            <h3 className="font-bold text-lg">Elimina obiettivo</h3>
            <p className="py-4 text-sm">
              Eliminare <strong>{goal.name}</strong>? È possibile solo nel mese di creazione: da quando riceve la prima
              quota ha una storia, e va annullato.
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Indietro</button>
              <button className="btn btn-error btn-sm" onClick={remove}>Elimina</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setModal(null)} />
        </div>
      )}
    </div>
  );
}
