/**
 * @fileoverview Dettaglio obiettivo — andamento, proiezione, quote mensili e spese collegate.
 */

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GoalChart from '@/components/obiettivi/GoalChart';
import { useTranslations } from 'next-intl';
import GoalStateBadge, { GOAL_STATE_CLASSES } from '@/components/obiettivi/GoalStateBadge';
import GoalFormModal from '@/components/obiettivi/GoalFormModal';
import { useFormat } from '@/lib/hooks/useFormat';
import useCan from '@/lib/auth/useCan';

/** @param {string} d - YYYY-MM-DD */
const formatDate = (d) => d.split('-').reverse().join('/');

/** Grassetto per i tag <b> dei messaggi. */
const b = (chunks) => <strong>{chunks}</strong>;

/**
 * Conferma di chiusura: "concludi" restituisce l'avanzo al libero, "annulla" permette di
 * girare il disponibile a un altro obiettivo attivo.
 */
function CloseModal({ mode, goal, otherGoals, onConfirm, onClose }) {
  const [transferTo, setTransferTo] = useState('');
  const [saving, setSaving] = useState(false);
  const t = useTranslations('goalDetail');
  const { fmtFull } = useFormat();
  const isComplete = mode === 'complete';

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-md">
        <h3 className="font-bold text-lg">{isComplete ? t('completeTitle') : t('cancelTitle')}</h3>
        <div className="py-4 text-sm space-y-2">
          {isComplete ? (
            <p>
              {t.rich(goal.available < 0 ? 'completeTextNegative' : 'completeText', {
                name: goal.name, available: fmtFull(goal.available), b,
              })}
            </p>
          ) : (
            <>
              <p>{t.rich('cancelText', { name: goal.name, available: fmtFull(goal.available), b })}</p>
              <select
                className="select select-bordered select-sm w-full"
                value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
                aria-label={t('destination')}
              >
                <option value="">{t('toFreeOption')}</option>
                {otherGoals.map((g) => <option key={g.id} value={g.id}>{t('toGoalOption', { name: g.name })}</option>)}
              </select>
            </>
          )}
          <p className="text-xs text-base-content/50">{t('reopenLater')}</p>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('goBack')}</button>
          <button
            className={`btn btn-sm ${isComplete ? 'btn-primary' : 'btn-warning'}`}
            disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm({ action: mode, transferTo: transferTo || null }); }}
          >
            {isComplete ? t('confirmComplete') : t('confirmCancel')}
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
  const t = useTranslations('goalDetail');
  const tGoals = useTranslations('goals');
  const tStates = useTranslations('goalStates');
  const tMov = useTranslations('movements');
  const tPay = useTranslations('payments');
  const tCommon = useTranslations('common');
  const { fmt, fmtFull, fmtMonth } = useFormat();

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
    const d = await res.json().catch(() => ({}));
    setModal(null);
    if (!res.ok) setActionError(d.error || t('actionFailed'));
    await load();
  };

  const remove = async () => {
    setActionError('');
    const res = await fetch(`/api/obiettivi/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/obiettivi');
      return;
    }
    const d = await res.json().catch(() => ({}));
    setModal(null);
    setActionError(d.error || t('deleteFailed'));
  };

  if (error) {
    return (
      <div>
        <Link href="/obiettivi" className="btn btn-ghost btn-sm mb-4">{t('backShort')}</Link>
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
    {
      label: t('kpi.saved'), val: fmtFull(goal.saved), primary: true,
      sub: t('kpi.savedSub', { pct: Math.round(goal.progress * 100), target: fmt(goal.targetAmount) }),
    },
    {
      label: t('kpi.available'), val: fmtFull(goal.available),
      sub: goal.spent > 0 ? t('kpi.spentSub', { amount: fmt(goal.spent) }) : t('kpi.noLinked'),
    },
  ];
  if (isActive && p) {
    kpis.push(
      {
        label: tGoals('currentShare'),
        val: goal.pct != null ? `${goal.pct}%` : '—',
        sub: p.expectedQuota != null ? t('kpi.shareSub', { amount: fmt(p.expectedQuota) }) : tGoals('kpi.noClosedMonth'),
      },
      goal.state === 'reached'
        ? { label: t('kpi.reached'), val: fmtMonth(goal.reachedMonth), sub: t('kpi.noMoreShares') }
        : {
          label: tGoals('needed'),
          val: p.requiredMonthly != null ? tGoals('perMonth', { amount: fmt(p.requiredMonthly) }) : '—',
          sub: t('kpi.neededSub', { count: p.monthsLeft, deadline: fmtMonth(goal.deadline) }),
        },
    );
  } else {
    kpis.push(
      {
        label: t('kpi.closedAt'), val: fmtMonth(goal.closedMonth),
        sub: Object.hasOwn(GOAL_STATE_CLASSES, goal.state) ? tStates(`${goal.state}.label`) : '',
      },
      { label: t('kpi.returned'), val: fmtFull(goal.returned), sub: goal.transferTo ? t('kpi.toOtherGoal') : t('kpi.toFree') },
    );
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4 sm:mb-6">
        <div className="flex items-start gap-2 min-w-0">
          <Link href="/obiettivi" className="btn btn-ghost btn-sm" aria-label={t('back')}>
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
              {t(goal.initialAmount > 0 ? 'headerInitial' : 'header', {
                target: fmt(goal.targetAmount), deadline: fmtMonth(goal.deadline),
                created: fmtMonth(goal.createdMonth), initial: fmt(goal.initialAmount),
              })}
            </p>
          </div>
        </div>
        {canManage && (
        <div className="flex gap-2 flex-wrap">
          {isActive ? (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setModal('edit')}>{t('edit')}</button>
              <button className="btn btn-primary btn-sm" onClick={() => setModal('complete')}>{t('purchased')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal('cancel')}>{t('cancel')}</button>
            </>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={() => patch({ action: 'reopen' })}>{t('reopen')}</button>
          )}
          {canDelete && (
            <button className="btn btn-ghost btn-sm text-error" onClick={() => setModal('delete')}>{t('delete')}</button>
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
              {goal.state === 'unknown' && t('projection.unknown')}
              {goal.state === 'expired' && t('projection.expired', { remaining: fmt(p.remaining) })}
              {(goal.state === 'on_track' || goal.state === 'behind') && (
                <>
                  {t.rich('projection.base', {
                    pct: goal.pct, avg: fmt(avgSavings), months: avgMonths,
                    projected: fmt(p.projectedAtDeadline), deadline: fmtMonth(goal.deadline), b,
                  })}
                  {goal.state === 'on_track'
                    ? t.rich('projection.onTrack', { reach: fmtMonth(p.reachMonth), b })
                    : t.rich(p.reachMonth ? 'projection.behindReach' : 'projection.behind', {
                      missing: fmt(goal.targetAmount - p.projectedAtDeadline), reach: fmtMonth(p.reachMonth), b,
                    })}
                </>
              )}
            </span>
          </div>
        )}

        <div className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="card-body p-4">
            <h3 className="text-sm font-semibold text-base-content/60 mb-1">{t('chartTitle')}</h3>
            <p className="text-xs text-base-content/40 mb-2">{t('chartLegend')}</p>
            <GoalChart goal={goal} currentMonth={currentMonth} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── Quote mensili ─────────────────────────────────────────── */}
          <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
            <div className="card-body p-4">
              <h3 className="text-sm font-semibold text-base-content/60 mb-2">{t('monthlyTitle')}</h3>
              {goal.monthly.length === 0 ? (
                <p className="text-sm text-base-content/40">{t('monthlyEmpty')}</p>
              ) : (
                <div className="overflow-x-auto max-h-80">
                  <table className="table table-xs table-pin-rows">
                    <thead>
                      <tr>
                        <th>{tCommon('month')}</th>
                        <th className="text-right">{t('columns.savings')}</th>
                        <th className="text-right">{'%'}</th>
                        <th className="text-right">{t('columns.share')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...goal.monthly].reverse().map((m) => (
                        <tr key={m.month} className="hover">
                          <td>{fmtMonth(m.month)}</td>
                          <td className={`text-right ${m.savings < 0 ? 'text-error' : ''}`}>{fmtFull(m.savings)}</td>
                          <td className="text-right">{`${m.pct}%`}</td>
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
              <h3 className="text-sm font-semibold text-base-content/60 mb-1">{t('linkedTitle')}</h3>
              <p className="text-xs text-base-content/40 mb-2">{t('linkedHint')}</p>
              {linkedMovements.length === 0 ? (
                <p className="text-sm text-base-content/40">{t('linkedEmpty')}</p>
              ) : (
                <div className="overflow-x-auto max-h-80">
                  <table className="table table-xs table-pin-rows">
                    <thead>
                      <tr>
                        <th>{tMov('columns.date')}</th>
                        <th>{t('columns.description')}</th>
                        <th className="text-right">{t('columns.amount')}</th>
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
                            <span className="text-base-content/40">
                              {` · ${tPay.has(m.paymentMethod) ? tPay(m.paymentMethod) : m.paymentMethod}`}
                            </span>
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
            <h3 className="font-bold text-lg">{t('deleteTitle')}</h3>
            <p className="py-4 text-sm">{t.rich('deleteText', { name: goal.name, b })}</p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>{t('goBack')}</button>
              <button className="btn btn-error btn-sm" onClick={remove}>{t('delete')}</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setModal(null)} />
        </div>
      )}
    </div>
  );
}
