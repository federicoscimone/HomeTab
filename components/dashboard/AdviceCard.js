'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';
import useCan from '@/lib/auth/useCan';

/** L'ultimo risultato resta nella scheda del browser: tornando sulla dashboard non si ripaga. */
const STORAGE_KEY = 'hometab-advice';

function loadSaved() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
}

function save(value) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Archivio del browser non disponibile: i consigli restano finché la pagina è aperta.
  }
}

/**
 * Consigli di risparmio, solo su richiesta: niente parte finché non si preme il pulsante.
 * Importi, link ed effetto sugli obiettivi vengono dal segnale calcolato dal codice; dall'IA
 * arrivano solo titolo, perché e azione.
 */
export default function AdviceCard() {
  const t = useTranslations('advice');
  const tIstat = useTranslations('istat');
  const canDo = useCan();
  const { fmtFull, fmtRound, fmtPct, fmtUsd, fmtDateTime, fmtMonthText: monthText } = useFormat();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [judged, setJudged] = useState({}); // key → true (utile) | false (nascosto)

  useEffect(() => {
    // sessionStorage esiste solo nel browser: si legge dopo il montaggio.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(loadSaved());
  }, []);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/consigli', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || t('failed'));
      const data = { ...(await res.json()), at: new Date().toISOString() };
      setResult(data);
      setJudged({});
      save(data);
    } catch (err) {
      setError(err.message || t('failed'));
    } finally {
      setBusy(false);
    }
  };

  const judge = async (a, useful) => {
    setJudged((j) => ({ ...j, [a.key]: useful }));
    await fetch('/api/consigli/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: a.key, kind: a.kind, useful }),
    }).catch(() => {});
  };

  const headline = (a) => {
    if (a.kind === 'recurring') return t('headline.recurring', { merchant: a.sample, monthly: fmtFull(a.monthly), annual: fmtRound(a.potential) });
    if (a.kind === 'growth') {
      return t('headline.growth', { category: a.categoryName ?? '—', recent: fmtRound(a.recentMonthly), previous: fmtRound(a.previousMonthly), pct: fmtPct(a.pct) });
    }
    if (a.kind === 'anomaly') {
      return t('headline.anomaly', { category: a.categoryName ?? '—', month: monthText(a.month), amount: fmtRound(a.amount), average: fmtRound(a.average) });
    }
    return t('headline.istat', { chapter: tIstat(`divisions.d${a.code}`), yours: fmtRound(a.yours), istat: fmtRound(a.istat), pct: fmtPct(a.pct) });
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title text-lg">{t('title')}</h2>
            <p className="text-sm text-base-content/60">{t('intro')}</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={ask} disabled={busy}>
            {busy && <span className="loading loading-spinner loading-sm" />}
            {result ? t('again') : t('ask')}
          </button>
        </div>

        {error && <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>}

        {result && result.advice.length === 0 && <p className="text-sm text-base-content/70">{t('none')}</p>}

        {result && result.advice.length > 0 && (
          <ul className="flex flex-col gap-3">
            {result.advice.map((a) => (
              <li key={a.key} className={`rounded-box border border-base-300 p-3 flex flex-col gap-1 ${judged[a.key] === false ? 'opacity-50' : ''}`}>
                {a.text && <p className="font-medium">{a.text.title}</p>}
                <p className={a.text ? 'text-sm text-base-content/70' : 'font-medium'}>{headline(a)}</p>
                {a.text && <p className="text-sm">{a.text.why}</p>}
                {a.text && <p className="text-sm"><span className="font-medium">{t('action')}</span>{' '}{a.text.action}</p>}
                <p className="text-sm">
                  {t(a.kind === 'anomaly' ? 'potentialOnce' : 'potential', { amount: fmtRound(a.potential) })}
                </p>
                {a.goal && (
                  <p className="text-sm text-success">
                    {a.goal.monthsEarlier
                      ? t('goalEarlier', { goal: a.goal.name, saving: fmtRound(a.monthlySaving), months: a.goal.monthsEarlier, reach: monthText(a.goal.reachMonth) })
                      : t('goalReach', { goal: a.goal.name, saving: fmtRound(a.monthlySaving), reach: monthText(a.goal.reachMonth) })}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link href={a.link} className="link link-primary text-sm">{t(a.kind === 'istat' ? 'openComparison' : 'openMovements')}</Link>
                  <span className="flex-1" />
                  {canDo('movements:edit') && (judged[a.key] === undefined ? (
                    <>
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => judge(a, true)}>{t('useful')}</button>
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => judge(a, false)}>{t('notUseful')}</button>
                    </>
                  ) : <span className="text-xs text-base-content/60">{t(judged[a.key] ? 'thanks' : 'hidden')}</span>)}
                </div>
              </li>
            ))}
          </ul>
        )}

        {result && (
          <p className="text-xs text-base-content/50">
            {[
              t('generatedAt', { at: fmtDateTime(result.at) }),
              t('signalsFound', { n: result.total }),
              result.ai ? t('cost', { cost: fmtUsd(result.costUsd) }) : t(`noAi.${['demo', 'budget', 'off', 'notConfigured'].includes(result.reason) ? result.reason : 'other'}`),
            ].join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
