/**
 * @fileoverview Shared formatting utilities for currency, percentages, months and dates.
 * Import from this module — do NOT redefine fmt/fmtFull/fmtPct locally. In components prefer
 * the useFormat() hook (lib/hooks/useFormat.js), which passes the interface language for you.
 * @module lib/utils/format
 */

import { DEFAULT_LOCALE, INTL_LOCALES } from '../i18n/locale.js';

const CURRENCY  = 'EUR';
const TIME_ZONE = 'Europe/Rome';

/**
 * Separatore delle migliaia sempre, anche a quattro cifre. La regola CLDR italiana lo mette solo
 * da cinque cifre in su ("1234,50 €" ma "12.345,50 €"): in una colonna di importi i due formati
 * affiancati sembrano un errore, e le app bancarie italiane scrivono sempre "1.234,50 €".
 */
const MONEY = { style: 'currency', currency: CURRENCY, useGrouping: 'always' };

/** @param {string} [locale] */
const intl = (locale) => INTL_LOCALES[locale] ?? INTL_LOCALES[DEFAULT_LOCALE];

/**
 * Nomi dei mesi scritti a mano invece che generati da Intl: le librerie della lingua di Node e
 * del browser non coincidono sempre (l'inglese britannico abbrevia settembre in "Sep" o "Sept"
 * secondo la versione), e il testo generato sul server deve coincidere con quello del browser.
 */
const MONTHS = {
  it: {
    short: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
    long:  ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
            'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  },
  en: {
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    long:  ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'],
  },
};

/**
 * @param {string} [locale] - 'it' | 'en'.
 * @param {'short'|'long'} [style]
 * @returns {string[]} Twelve month names, index 0 = January.
 */
export function monthNames(locale = DEFAULT_LOCALE, style = 'short') {
  return (MONTHS[locale] ?? MONTHS[DEFAULT_LOCALE])[style];
}

/**
 * Formats a number as a compact Euro currency string (no cents).
 * Returns an em-dash when the value is falsy (0, null, undefined).
 *
 * @param {number|null|undefined} value - Monetary amount in euros.
 * @param {string} [locale] - 'it' | 'en'.
 * @returns {string} Formatted string, e.g. "1.234 €" (it), "€1,234" (en) or "—".
 */
export function fmt(value, locale = DEFAULT_LOCALE) {
  return value ? fmtRound(value, locale) : '—';
}

/**
 * Like fmt, but zero is a number too: for totals that are meaningful at 0.
 *
 * @param {number|null|undefined} value - Monetary amount in euros.
 * @param {string} [locale] - 'it' | 'en'.
 * @returns {string} e.g. "0 €" (it) or "€0" (en).
 */
export function fmtRound(value, locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(intl(locale), { ...MONEY, maximumFractionDigits: 0 }).format(value ?? 0);
}

/**
 * Short amount for chart axes: thousands become "k", with at most one decimal.
 * Intl's compact notation doesn't help here: in Italian it doesn't shorten thousands ("1500 €").
 *
 * @param {number|null|undefined} value - Monetary amount in euros.
 * @param {string} [locale] - 'it' | 'en'.
 * @returns {string} e.g. "1,5k €" (it), "€1.5k" (en), "800 €" (it).
 */
export function fmtAxis(value, locale = DEFAULT_LOCALE) {
  const abs = Math.abs(value ?? 0);
  const thousands = abs >= 1000;
  const number = new Intl.NumberFormat(intl(locale), { maximumFractionDigits: thousands ? 1 : 0, useGrouping: 'always' })
    .format(thousands ? abs / 1000 : abs);
  const amount = thousands ? `${number}k` : number;
  const sign = value < 0 ? '-' : '';
  return locale === 'en' ? `${sign}€${amount}` : `${sign}${amount} €`;
}

/**
 * Formats a number as a full Euro currency string (with cents).
 * Always returns a formatted value — never an em-dash.
 *
 * @param {number} value - Monetary amount in euros.
 * @param {string} [locale] - 'it' | 'en'.
 * @returns {string} Formatted string, e.g. "1.234,56 €" (it) or "€1,234.56" (en).
 */
export function fmtFull(value, locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(intl(locale), MONEY).format(value ?? 0);
}

/**
 * Formats a percentage delta with a leading "+" for positive values.
 * Returns an em-dash when the value is null/undefined (no prior data).
 *
 * @param {number|null|undefined} value - Percentage value (e.g. 12.5 means 12.5%).
 * @param {string} [locale] - 'it' | 'en'.
 * @param {boolean} [signed=true] - false to drop the sign (when an arrow already shows it).
 * @returns {string} e.g. "+12,5%" (it), "+12.5%" (en) or "—".
 */
export function fmtPct(value, locale = DEFAULT_LOCALE, signed = true) {
  if (value == null) return '—';
  return new Intl.NumberFormat(intl(locale), {
    style: 'percent',
    signDisplay: signed ? 'exceptZero' : 'never',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/**
 * Returns the CSS class for a delta value based on the expense/income direction.
 * For expenses: positive delta (spending more) → error (red).
 * For income:   positive delta (earning more)  → success (green).
 *
 * @param {number|null|undefined} delta - The change value.
 * @param {'expense'|'income'} type - Record type.
 * @returns {string} Tailwind/DaisyUI text colour class.
 */
export function deltaClass(delta, type = 'expense') {
  if (!delta) return '';
  if (type === 'expense') return delta > 0 ? 'text-error' : 'text-success';
  return delta > 0 ? 'text-success' : 'text-error';
}

/**
 * Formats a 'YYYY-MM' month string for display.
 *
 * @param {string|null|undefined} month - Month in 'YYYY-MM' format.
 * @param {boolean} [short=false] - Two-digit year (for chart axes).
 * @param {string} [locale] - 'it' | 'en'.
 * @returns {string} e.g. "Ago 2027", "Aug 27" or "—".
 */
export function fmtMonth(month, short = false, locale = DEFAULT_LOCALE) {
  if (!month) return '—';
  const [y, m] = month.split('-');
  return `${monthNames(locale)[Number(m) - 1]} ${short ? y.slice(2) : y}`;
}

/**
 * Formats a 'YYYY-MM-DD' date with the month name written out. Built from the month table above
 * instead of Intl, for the same reason: identical text on server and browser.
 *
 * @param {string|null|undefined} date - 'YYYY-MM-DD' (a longer ISO string works too).
 * @param {string} [locale] - 'it' | 'en'.
 * @returns {string} e.g. "7 ott 2026" (it), "7 Oct 2026" (en) or "—".
 */
export function fmtDate(date, locale = DEFAULT_LOCALE) {
  if (!date) return '—';
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  const month = monthNames(locale)[m - 1];
  // In italiano il mese dentro una data va minuscolo.
  return `${d} ${locale === 'en' ? month : month.toLowerCase()} ${y}`;
}

/**
 * Formats an ISO timestamp (or Date) as a local date and time, in the Italian time zone.
 *
 * @param {string|Date|null|undefined} value
 * @param {string} [locale] - 'it' | 'en'.
 * @param {Intl.DateTimeFormatOptions} [options] - Defaults to short date and time.
 * @returns {string} e.g. "07/10/26, 14:30" or "—".
 */
export function fmtDateTime(value, locale = DEFAULT_LOCALE, options = { dateStyle: 'short', timeStyle: 'short' }) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(intl(locale), { timeZone: TIME_ZONE, ...options }).format(new Date(value));
}

/**
 * @deprecated Italian only: use monthNames(locale, 'short') or useFormat().monthsShort.
 * Index 1-based: index 0 is an empty string.
 */
export const MONTHS_SHORT = ['', ...MONTHS.it.short];

/** @deprecated Italian only: use monthNames(locale, 'long') or useFormat().monthsLong. */
export const MONTHS_FULL = MONTHS.it.long;
