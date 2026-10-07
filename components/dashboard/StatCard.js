/**
 * @fileoverview StatCard — a single KPI tile for the dashboard.
 */

import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/**
 * Calculates the percentage change from `prev` to `cur`.
 *
 * @param {number} cur  - Current period value.
 * @param {number} prev - Previous period value.
 * @returns {number|null} Percentage change, or null if there is no prior data.
 */
function pctDelta(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

/**
 * KPI stat card with a current value and an optional % delta vs the previous period.
 *
 * @param {object}  props
 * @param {string}  props.title      - Label shown above the value.
 * @param {number}  props.value      - Current period amount in euros.
 * @param {number}  props.prevValue  - Previous period amount (used for delta calc).
 * @param {string}  [props.color]    - Tailwind text colour class for the value.
 * @param {string}  [props.prefix]   - Optional prefix string (e.g. "+").
 * @param {boolean} [props.higherIsBetter] - true when a rise is good news (income).
 */
export default function StatCard({ title, value, prevValue, color = 'text-base-content', prefix = '', higherIsBetter = false }) {
  const pct = pctDelta(value, prevValue);
  const t = useTranslations('dashboard');
  const { fmtRound, fmtPct } = useFormat();
  // Più spese è un peggioramento, più entrate un miglioramento: prima ogni aumento era rosso,
  // comprese le entrate cresciute.
  const worse = higherIsBetter ? pct < 0 : pct > 0;
  // Sotto lo 0,05% la variazione si legge "0,0%": nessuna freccia e nessun colore.
  const flat = pct !== null && Math.abs(pct) < 0.05;
  const tone = flat ? 'text-base-content/50' : worse ? 'text-error' : 'text-success';
  const arrow = flat ? '' : pct > 0 ? '▲ ' : '▼ ';

  return (
    <div className="stat bg-base-100 rounded-xl border border-base-200 shadow-sm">
      <div className="stat-title text-xs">{title}</div>
      <div className={`stat-value text-xl sm:text-2xl ${color}`}>
        {prefix}{fmtRound(value)}
      </div>
      {pct !== null && (
        <div className={`stat-desc text-xs mt-1 ${tone}`}>
          {arrow}{t('vsPrevMonth', { pct: fmtPct(pct, false) })}
        </div>
      )}
      {pct === null && prevValue === 0 && (
        <div className="stat-desc text-xs mt-1 text-base-content/40">{t('noPrevMonth')}</div>
      )}
    </div>
  );
}
