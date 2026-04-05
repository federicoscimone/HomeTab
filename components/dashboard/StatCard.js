/**
 * @fileoverview StatCard — a single KPI tile for the dashboard.
 */

import { fmt } from '@/lib/utils/format';

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
 */
export default function StatCard({ title, value, prevValue, color = 'text-base-content', prefix = '' }) {
  const pct = pctDelta(value, prevValue);

  return (
    <div className="stat bg-base-100 rounded-xl border border-base-200 shadow-sm">
      <div className="stat-title text-xs">{title}</div>
      <div className={`stat-value text-xl sm:text-2xl ${color}`}>
        {prefix}{fmt(value) !== '—' ? fmt(value) : '€0'}
      </div>
      {pct !== null && (
        <div className={`stat-desc text-xs mt-1 ${pct > 0 ? 'text-error' : 'text-success'}`}>
          {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% vs mese prec.
        </div>
      )}
      {pct === null && prevValue === 0 && (
        <div className="stat-desc text-xs mt-1 text-base-content/40">Nessun dato mese prec.</div>
      )}
    </div>
  );
}
