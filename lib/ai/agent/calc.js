/**
 * @fileoverview La calcolatrice della chat: somme, differenze e medie di numeri già noti.
 * @module lib/ai/agent/calc
 *
 * La regola della chat resta «il modello non fa i conti»: un modello che somma a mente sbaglia, e
 * lo fa con sicurezza. Ma senza un modo per fare una sottrazione, a «stipendi meno uscite» poteva
 * solo rispondere «fatela voi». Qui il conto lo fa il codice, e ogni termine deve essere un numero
 * già comparso nella conversazione: in un risultato di uno strumento, in una risposta precedente o
 * nella domanda. Un numero inventato viene rifiutato e il modello deve prenderlo da uno strumento.
 *
 * Passano solo numeri ed etichette: nessun dato dei movimenti, quindi niente da mascherare.
 */

/** Tolleranza: un centesimo, perché i testi riportano gli importi arrotondati al centesimo. */
const EPSILON = 0.005;

/**
 * I numeri scritti in un testo, nel formato della lingua: «35.860,00 €», «-2.303,06», «2000».
 * Il segno si ignora: conta il valore, il segno lo sceglie il termine del calcolo.
 *
 * @param {string} text
 * @param {'it'|'en'} locale
 * @returns {number[]}
 */
export function numbersInText(text, locale = 'it') {
  const [thousands, decimal] = locale === 'en' ? [',', '.'] : ['.', ','];
  const t = thousands === '.' ? '\\.' : ',';
  const d = decimal === '.' ? '\\.' : ',';
  const re = new RegExp(`\\d{1,3}(?:${t}\\d{3})+(?:${d}\\d+)?|\\d+(?:${d}\\d+)?`, 'g');
  return (text.match(re) ?? []).map((m) => Number(m.split(thousands).join('').replace(decimal, '.')));
}

/**
 * I numeri di un risultato di uno strumento (JSON): ogni valore numerico, a qualsiasi livello.
 * Gli importi hanno la forma { valore, testo }: basta il primo.
 *
 * @param {string} content
 * @returns {number[]}
 */
export function numbersInToolResult(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }
  const found = [];
  const walk = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) found.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(data);
  return found;
}

/** L'insieme dei numeri noti, confrontati per valore assoluto con la tolleranza di un centesimo. */
export class KnownNumbers {
  constructor() {
    this.values = [];
  }

  add(numbers) {
    for (const n of numbers) if (Number.isFinite(n)) this.values.push(Math.abs(n));
  }

  has(n) {
    const a = Math.abs(n);
    return this.values.some((v) => Math.abs(v - a) < EPSILON);
  }
}

/**
 * Il calcolo: somma dei termini con il loro segno, e la media se c'è un divisore.
 *
 * @param {{ etichetta: string, valore: number, segno: '+'|'-' }[]} terms
 * @param {KnownNumbers} known
 * @param {number} [divideBy] - Per una media: mesi o elementi, un intero piccolo.
 * @returns {{ total: number, average: number|null } | { unknown: number[] }}
 */
export function calculate(terms, known, divideBy) {
  const unknown = terms.map((t) => t.valore).filter((v) => !known.has(v));
  if (unknown.length) return { unknown };
  // Il valore tiene il suo segno (un risparmio negativo resta negativo); «-» lo sottrae.
  const cents = terms.reduce((sum, t) => sum + (t.segno === '-' ? -1 : 1) * Math.round(t.valore * 100), 0);
  const total = cents / 100;
  return { total, average: divideBy ? Math.round(cents / divideBy) / 100 : null };
}
