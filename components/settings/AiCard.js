'use client';

import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * Stato dell'IA e spesa del mese rispetto al tetto, con le ultime chiamate.
 * @param {{ data: object|null }} props - La risposta di GET /api/ai/settings.
 */
export default function AiCard({ data }) {
  const t = useTranslations('settingsAi');
  const { fmtUsd, fmtDateTime, fmtMonth } = useFormat();

  const available = data?.import?.available;
  const pct = data?.capUsd ? Math.min(100, (data.spentUsd / data.capUsd) * 100) : 0;
  const calls = data?.calls ?? {};
  const totalCalls = Object.values(calls).reduce((a, b) => a + b, 0);

  return (
    <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
      <div className="card-body gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="card-title text-lg">{t('title')}</h2>
            <p className="text-sm text-base-content/60">{t('intro')}</p>
          </div>
          {data && (
            <div className={`badge ${available ? 'badge-success' : 'badge-ghost'}`}>
              {available ? t('active') : t('inactive')}
            </div>
          )}
        </div>

        {data && !available && (
          <div className="alert alert-info py-2 text-sm">
            <span>{t(`reasons.${data.import.reason}`, { model: data.import.model ?? '' })}</span>
          </div>
        )}

        {data && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-base-200 p-4">
                <p className="text-sm font-medium">{t('importModel')}</p>
                <p className="text-sm text-base-content/70 mt-1 font-mono">{data.import.model ?? t('none')}</p>
              </div>
              <div className="rounded-xl border border-base-200 p-4">
                <p className="text-sm font-medium">{t('callsThisMonth')}</p>
                <p className="text-sm text-base-content/70 mt-1">
                  {t('callsSummary', { total: totalCalls, failed: (calls.error ?? 0) + (calls.unknown ?? 0) + (calls.invalid ?? 0) })}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-base-200 p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-sm font-medium">{t('spending', { month: fmtMonth(data.month) })}</p>
                <p className="text-sm tabular-nums ml-auto text-right">
                  {t('spentOfCap', { spent: fmtUsd(data.spentUsd), cap: fmtUsd(data.capUsd) })}
                </p>
              </div>
              <progress
                className={`progress w-full mt-2 ${pct >= 90 ? 'progress-error' : 'progress-primary'}`}
                value={pct}
                max={100}
                aria-label={t('spendingBar')}
              />
              <p className="text-xs text-base-content/60 mt-2">{t('capHint')}</p>
            </div>

            {data.recent.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>{t('cols.when')}</th>
                      <th>{t('cols.task')}</th>
                      <th>{t('cols.outcome')}</th>
                      <th className="text-right">{t('cols.tokens')}</th>
                      <th className="text-right">{t('cols.cost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                        <td>{t.has(`tasks.${r.task}`) ? t(`tasks.${r.task}`) : r.task}</td>
                        <td>{t(`outcomes.${r.outcome}`)}</td>
                        <td className="text-right tabular-nums">{t('tokensInOut', { input: r.inputTokens + r.cacheReadTokens, output: r.outputTokens })}</td>
                        <td className="text-right tabular-nums">{fmtUsd(r.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
