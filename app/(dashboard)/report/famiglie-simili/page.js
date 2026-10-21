/**
 * @fileoverview Confronto con le famiglie simili: le vostre spese per capitolo accanto alla media
 * ISTAT per la vostra regione e il vostro numero di componenti.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useApiData } from '@/lib/hooks/useApiData';
import { useFormat } from '@/lib/hooks/useFormat';
import useCan from '@/lib/auth/useCan';
import { MAX_MEMBERS } from '@/lib/utils/istat';
import IstatSettingsCard from '@/components/istat/IstatSettingsCard';

/** Due barre sovrapposte: voi e ISTAT, sulla stessa scala di tutta la tabella. */
function Bars({ yours, istat, max }) {
  const w = (v) => `${max > 0 && v ? Math.min(100, (v / max) * 100) : 0}%`;
  return (
    <div className="flex flex-col gap-0.5 w-full min-w-24" aria-hidden="true">
      <div className="h-2 rounded bg-primary" style={{ width: w(yours) }} />
      <div className="h-2 rounded bg-base-content/25" style={{ width: w(istat) }} />
    </div>
  );
}

export default function FamiglieSimiliPage() {
  const t = useTranslations('istat');
  const canDo = useCan();
  const { fmtRound, fmtPct, fmtDate, deltaClass } = useFormat();
  const { data, loading, error, reload } = useApiData('/api/report/istat', 'report/istat');
  const admin = canDo('settings:manage');
  const { data: categories, reload: reloadCategories } = useApiData(admin ? '/api/categorie' : null, 'categorie');

  const membersText = (n) => (n >= MAX_MEMBERS ? t('membersMany') : t('membersCount', { n }));
  const areaName = (code) => t(`regions.${code}`);

  if (error) return <div className="alert alert-error"><span>{t('loadFailed')}</span></div>;
  // Lo spinner solo al primo caricamento: dopo un salvataggio restano i dati di prima, così la
  // scheda delle impostazioni non si smonta e il suo messaggio resta visibile.
  if (!data) return loading ? <span className="loading loading-spinner" /> : null;

  const { profile, period, rows, total, unmapped, uncategorized } = data;
  const max = Math.max(...rows.flatMap((r) => [r.yours ?? 0, r.istat ?? 0]));
  const subtitle = t('subtitle', {
    from: fmtDate(period.from),
    to: fmtDate(period.to),
    months: period.months,
    year: String(data.istatYear),
    members: profile.members ? membersText(profile.members) : t('anyMembers'),
    region: profile.region ? areaName(profile.region) : areaName('IT'),
  });

  const note = (r) => {
    const parts = [];
    if (r.estimated) parts.push(t('estimated'));
    if (r.area && r.area !== profile.region && profile.region) parts.push(t('fromArea', { area: areaName(r.area) }));
    return parts.join(' · ');
  };

  const line = (label, r, strong = false) => (
    <tr key={label} className={strong ? 'font-semibold' : ''}>
      <td className="whitespace-normal">
        <div>{label}</div>
        {note(r) && <div className="text-xs font-normal text-base-content/50">{note(r)}</div>}
      </td>
      <td className="text-right tabular-nums">{r.yours == null ? '—' : fmtRound(r.yours)}</td>
      <td className="text-right tabular-nums">{r.istat == null ? '—' : fmtRound(r.istat)}</td>
      <td className={`text-right tabular-nums ${deltaClass(r.diff, 'expense')}`}>
        {r.diff == null ? '—' : <>{fmtRound(r.diff)}<span className="block text-xs">{fmtPct(r.pct)}</span></>}
      </td>
      <td className="hidden sm:table-cell w-1/4">{!strong && <Bars yours={r.yours} istat={r.istat} max={max} />}</td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-base-content/60">{t('intro')}</p>
      </div>

      {!data.profileComplete && (
        <div className="alert alert-info text-sm py-2"><span>{t(admin ? 'profileMissing' : 'profileMissingViewer')}</span></div>
      )}

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <p className="text-sm">{subtitle}</p>
          {period.months === 0 ? <p className="text-sm text-base-content/60">{t('noData')}</p> : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{t('cols.chapter')}</th>
                    <th className="text-right">{t('cols.yours')}</th>
                    <th className="text-right">{t('cols.istat')}</th>
                    <th className="text-right">{t('cols.diff')}</th>
                    <th className="hidden sm:table-cell">
                      <span className="flex gap-3 text-xs font-normal">
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-primary" />{t('cols.yours')}</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded bg-base-content/25" />{t('cols.istat')}</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => line(t(`divisions.d${r.code}`), r))}
                  {line(t('total'), total, true)}
                </tbody>
              </table>
            </div>
          )}

          {(unmapped.length > 0 || uncategorized > 0) && (
            <div className="text-sm">
              <p className="font-medium">{t('notCompared')}</p>
              <p className="text-xs text-base-content/60 mb-1">{t('notComparedHint')}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {unmapped.map((u) => <li key={u.name}>{t('perMonth', { name: u.name, amount: fmtRound(u.monthly) })}</li>)}
                {uncategorized > 0 && <li>{t('perMonth', { name: t('uncategorized'), amount: fmtRound(uncategorized) })}</li>}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-2 text-sm">
          <h2 className="font-medium">{t('notes.title')}</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1 text-base-content/80">
            <li>{t('notes.average')}</li>
            <li>{t('notes.housing')}</li>
            <li>{t('notes.yours')}</li>
            <li>{t('notes.total')}</li>
          </ul>
          <p className="text-xs text-base-content/60">{t('notes.source', { year: String(data.istatYear) })}</p>
        </div>
      </div>

      {admin && categories && (
        <IstatSettingsCard
          profile={profile}
          categories={categories}
          startOpen={!data.profileComplete}
          onSaved={() => { reload(); reloadCategories(); }}
        />
      )}
    </div>
  );
}
