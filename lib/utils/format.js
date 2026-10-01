/**
 * @fileoverview Shared formatting utilities for currency, percentages, and dates.
 * Import from this module — do NOT redefine fmt/fmtFull/fmtPct locally.
 * @module lib/utils/format
 */

const IT_LOCALE = 'it-IT';
const CURRENCY  = 'EUR';

/**
 * Formats a number as a compact Euro currency string (no cents).
 * Returns an em-dash when the value is falsy (0, null, undefined).
 *
 * @param {number|null|undefined} value - Monetary amount in euros.
 * @returns {string} Formatted string, e.g. "€1.234" or "—".
 *
 * @example
 * fmt(1234.56) // "1.234 €"
 * fmt(0)       // "—"
 * fmt(null)    // "—"
 */
export function fmt(value) {
  if (!value && value !== 0) return '—';
  if (value === 0) return '—';
  return new Intl.NumberFormat(IT_LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formats a number as a full Euro currency string (with cents).
 * Always returns a formatted value — never an em-dash.
 *
 * @param {number} value - Monetary amount in euros.
 * @returns {string} Formatted string, e.g. "1.234,56 €".
 *
 * @example
 * fmtFull(1234.56) // "1.234,56 €"
 */
export function fmtFull(value) {
  return new Intl.NumberFormat(IT_LOCALE, {
    style: 'currency',
    currency: CURRENCY,
  }).format(value ?? 0);
}

/**
 * Formats a percentage delta with a leading "+" for positive values.
 * Returns an em-dash when the value is null/undefined (no prior data).
 *
 * @param {number|null|undefined} value - Percentage value (e.g. 12.5 means 12.5%).
 * @returns {string} Formatted string, e.g. "+12.5%" or "-3.2%" or "—".
 *
 * @example
 * fmtPct(12.5)  // "+12.5%"
 * fmtPct(-3.2)  // "-3.2%"
 * fmtPct(null)  // "—"
 */
export function fmtPct(value) {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Returns the CSS class for a delta value based on the expense/income direction.
 * For expenses: positive delta (spending more) → error (red).
 * For income:   positive delta (earning more)  → success (green).
 *
 * @param {number|null|undefined} delta - The change value.
 * @param {'expense'|'income'} type - Record type.
 * @returns {string} Tailwind/DaisyUI text colour class.
 *
 * @example
 * deltaClass(100, 'expense') // "text-error"
 * deltaClass(-50, 'expense') // "text-success"
 * deltaClass(100, 'income')  // "text-success"
 * deltaClass(0, 'expense')   // ""
 */
export function deltaClass(delta, type = 'expense') {
  if (!delta) return '';
  if (type === 'expense') return delta > 0 ? 'text-error' : 'text-success';
  return delta > 0 ? 'text-success' : 'text-error';
}

/** Italian short month names (index 1-based: index 0 is empty string). */
export const MONTHS_SHORT = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/** Italian full month names (index 0-based). */
export const MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/**
 * Formats a 'YYYY-MM' month string for display.
 *
 * @param {string|null|undefined} month - Month in 'YYYY-MM' format.
 * @param {boolean} [short=false] - Two-digit year (for chart axes).
 * @returns {string} e.g. "Ago 2027", "Ago 27" or "—".
 *
 * @example
 * fmtMonth('2027-08')       // "Ago 2027"
 * fmtMonth('2027-08', true) // "Ago 27"
 */
export function fmtMonth(month, short = false) {
  if (!month) return '—';
  const [y, m] = month.split('-');
  return `${MONTHS_SHORT[Number(m)]} ${short ? y.slice(2) : y}`;
}
