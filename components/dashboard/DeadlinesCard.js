'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';

const SHOWN = 5;

/** Le prossime scadenze e la quota da accantonare ogni mese. Senza scadenze non compare. */
export default function DeadlinesCard() {
  const t = useTranslations('deadlines');
  const { fmtFull, fmtRound, fmtDate } = useFormat();
  const { data } = useApiData('/api/scadenze', 'scadenze');
  if (!data || data.deadlines.length === 0) return null;

  const soon = data.deadlines.filter((d) => d.active && d.daysLeft <= 30).slice(0, SHOWN);
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-lg">{t('cardTitle')}</h2>
          <Link href="/scadenze" className="link link-primary text-sm">{t('openAll')}</Link>
        </div>
        {soon.length === 0 ? <p className="text-sm text-base-content/60">{t('nothingSoon')}</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {soon.map((d) => (
              <li key={d.id} className="flex items-center gap-3">
                <span className={`w-24 shrink-0 ${d.daysLeft < 0 && !d.payment ? 'text-warning' : 'text-base-content/60'}`}>{fmtDate(d.nextDate)}</span>
                <span className="flex-1 truncate">{d.title}</span>
                {d.payment && <span className="badge badge-success badge-sm">{t('paidBadge')}</span>}
                <span className="tabular-nums">{d.amount != null ? fmtFull(d.amount) : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {data.totals.monthlyReserve > 0 && (
          <p className="text-sm">{t('cardReserve', { amount: fmtRound(data.totals.monthlyReserve) })}</p>
        )}
      </div>
    </div>
  );
}
