'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';

const STATE_BADGE = { on_track: 'badge-success', behind: 'badge-warning', reached: 'badge-info', expired: 'badge-error' };

/** Il risparmio mese per mese: pieno i mesi chiusi, chiaro il mese in corso e le stime. */
function MonthBars({ months, monthsShort }) {
  const max = Math.max(1, ...months.map((m) => Math.abs(m.savings)));
  const hasNegative = months.some((m) => m.savings < 0);
  return (
    <div className="flex items-stretch gap-1 h-24" aria-hidden="true">
      {months.map((m) => {
        const h = `${(Math.abs(m.savings) / max) * (hasNegative ? 50 : 100)}%`;
        const tone = m.kind === 'actual' ? 'bg-primary' : m.kind === 'current' ? 'bg-primary/60' : 'bg-primary/25';
        const color = m.savings < 0 ? 'bg-error/70' : tone;
        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="flex-1 w-full flex flex-col">
              <div className="flex-1 flex items-end">
                {m.savings >= 0 && <div className={`w-full rounded-t ${color}`} style={{ height: h }} />}
              </div>
              {hasNegative && (
                <div className="flex-1 flex items-start border-t border-base-300">
                  {m.savings < 0 && <div className={`w-full rounded-b ${color}`} style={{ height: h }} />}
                </div>
              )}
            </div>
            <span className="text-[10px] text-base-content/50">{monthsShort[Number(m.month.slice(5)) - 1].slice(0, 1)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * «Quanto avremo risparmiato quest'anno continuando così?» e «riusciremo a raggiungere gli
 * obiettivi?», senza IA: i numeri sono quelli di /api/report/proiezione.
 */
export default function YearProjectionCard() {
  const t = useTranslations('projection');
  const tStates = useTranslations('goalStates');
  const { fmtRound, fmtMonthText, monthsShort } = useFormat();
  const { data, error } = useApiData('/api/report/proiezione', 'report/proiezione');

  if (error) return null;
  if (!data) return <div className="card bg-base-100 shadow-sm"><div className="card-body"><span className="loading loading-spinner" /></div></div>;

  const p = data.projection;
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div>
          <h2 className="card-title text-lg">{t('title', { year: String(p?.year ?? new Date().getFullYear()) })}</h2>
          <p className="text-sm text-base-content/60">{t('intro')}</p>
        </div>

        {!p ? <p className="text-sm text-base-content/70">{t('notYet')}</p> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-box bg-base-200 p-3">
                <p className="text-xs text-base-content/60">{t('soFar')}</p>
                <p className="text-xl font-semibold tabular-nums">{fmtRound(p.actual.savings)}</p>
              </div>
              <div className="rounded-box bg-primary/10 p-3">
                <p className="text-xs text-base-content/60">{t('yearEnd')}</p>
                <p className="text-xl font-semibold tabular-nums text-primary">{fmtRound(p.projected.savings)}</p>
                <p className="text-xs text-base-content/60">{t('flows', { income: fmtRound(p.projected.income), expense: fmtRound(p.projected.expense) })}</p>
              </div>
              <div className="rounded-box bg-base-200 p-3">
                <p className="text-xs text-base-content/60">{t('lastYear', { year: String(p.year - 1) })}</p>
                <p className="text-xl font-semibold tabular-nums">{p.lastYear ? fmtRound(p.lastYear.savings) : '—'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <MonthBars months={p.months} monthsShort={monthsShort} />
              <p className="flex flex-wrap gap-3 text-xs text-base-content/60">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-primary" />{t('legendActual')}</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-primary/25" />{t('legendEstimate')}</span>
              </p>
            </div>
            <p className="text-xs text-base-content/60">{t(p.method === 'seasonal' ? 'howSeasonal' : 'howAverage')}</p>
          </>
        )}

        {data.goals.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{t('goalsTitle')}</h3>
              <Link href="/obiettivi" className="link link-primary text-sm">{t('openGoals')}</Link>
            </div>
            <ul className="flex flex-col gap-2">
              {data.goals.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{g.name}</span>
                  <span className={`badge badge-sm ${STATE_BADGE[g.state] ?? 'badge-ghost'}`}>
                    {tStates.has(`${g.state}.label`) ? tStates(`${g.state}.label`) : g.state}
                  </span>
                  <span className="text-base-content/70">
                    {g.reachMonth
                      ? t('reach', { reach: fmtMonthText(g.reachMonth), deadline: fmtMonthText(g.deadline) })
                      : t('noReach', { deadline: fmtMonthText(g.deadline) })}
                  </span>
                  {g.state === 'behind' && g.requiredMonthly != null && (
                    <span className="text-warning">
                      {t('needed', { required: fmtRound(g.requiredMonthly), expected: fmtRound(g.expectedMonthly ?? 0) })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
