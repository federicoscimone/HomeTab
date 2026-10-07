/**
 * @fileoverview Periodi da confrontare in un report anno su anno.
 * @module lib/utils/comparePeriods
 *
 * Un anno (o un mese) ancora in corso confrontato con l'anno precedente intero sembra sempre in
 * calo: a ottobre mancano quasi tre mesi di spese. Per questo, quando il periodo scelto contiene
 * oggi, si calcolano due basi di confronto: lo stesso periodo dell'anno prima (dal primo giorno
 * fino alla stessa data) e il periodo intero. Per un periodo già concluso le due coincidono.
 *
 * Le date sono stringhe YYYY-MM-DD come nei movimenti, e "-31" come fine mese funziona per
 * qualunque mese perché il confronto fra stringhe è lessicografico.
 */

const pad = (n) => String(n).padStart(2, '0');

/**
 * @param {Date} [now]
 * @returns {string} Data locale del server come YYYY-MM-DD.
 */
export function todayString(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * @param {string} date - YYYY-MM-DD.
 * @returns {string} Stesso giorno dell'anno precedente; il 29 febbraio diventa il 28.
 */
export function sameDayPreviousYear(date) {
  const [y, m, d] = date.split('-').map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y - 1}-${pad(m)}-${pad(day)}`;
}

/**
 * @typedef {{ from: string, to: string }} Range
 * @typedef {Object} ComparisonPeriods
 * @property {Range} current        - Periodo scelto, troncato a oggi se in corso.
 * @property {Range} previousFull   - Lo stesso periodo dell'anno prima, intero.
 * @property {Range} previousToDate - Dell'anno prima, fino alla stessa data di oggi.
 * @property {string|null} cutoff   - Oggi, se il periodo scelto è in corso; altrimenti null.
 */

/**
 * @param {number}      year
 * @param {number|null} month - 1-12 per un mese, null per l'anno intero.
 * @param {string}      today - YYYY-MM-DD.
 * @returns {ComparisonPeriods}
 */
export function comparisonPeriods(year, month, today) {
  const span = (y) => (month
    ? { from: `${y}-${pad(month)}-01`, to: `${y}-${pad(month)}-31` }
    : { from: `${y}-01-01`, to: `${y}-12-31` });

  const current = span(year);
  const previousFull = span(year - 1);
  const inProgress = today >= current.from && today <= current.to;

  if (!inProgress) {
    return { current, previousFull, previousToDate: previousFull, cutoff: null };
  }
  return {
    current: { from: current.from, to: today },
    previousFull,
    previousToDate: { from: previousFull.from, to: sameDayPreviousYear(today) },
    cutoff: today,
  };
}
