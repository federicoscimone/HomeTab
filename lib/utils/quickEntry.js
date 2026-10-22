/**
 * @fileoverview Una spesa scritta al bot in una riga: «12,50 pizza», «ieri 40 benzina contanti»,
 * «+1500 stipendio». Senza IA: importo, data, metodo di pagamento e descrizione si leggono da qui,
 * la categoria la trova la catena locale dell'import (parole chiave, storico).
 * @module lib/utils/quickEntry
 */

/** Parole che indicano il metodo di pagamento; la prima trovata vince e si toglie dal testo. */
const METHODS = [
  [/\bbuon[io] pasto\b|\bticket\b/i, 'meal_ticket'],
  [/\bcontant[ie]\b|\bcash\b/i, 'cash'],
  [/\bbancomat\b|\bdebito\b/i, 'debit_card'],
  [/\bcarta( di credito)?\b|\bcredito\b/i, 'credit_card'],
  [/\bsatispay\b/i, 'satispay'],
  [/\bpaypal\b/i, 'paypal'],
  [/\bbonifico\b/i, 'bank_transfer'],
];
/** Senza indicazioni: la carta di debito, il pagamento più comune per le spese di tutti i giorni. */
export const DEFAULT_METHOD = 'debit_card';

const DATE_WORDS = [[/\bieri\b|\byesterday\b/i, -1], [/\baltro ?ieri\b/i, -2]];
const AMOUNT_RE = /(^|\s)([+-]?)(\d{1,7}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(€|eur|euro)?(?=\s|$)/gi;

/** «1.234,50», «1234.5», «12,5» → numero; l'ultimo separatore con 1-2 cifre dopo è il decimale. */
export function parseAmount(raw) {
  const m = raw.match(/^(.*?)(?:[.,](\d{1,2}))?$/);
  const whole = m[1].replace(/[.,]/g, '');
  const value = Number(`${whole}.${m[2] ?? '0'}`);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function shiftDate(today, days) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} text
 * @param {string} today - YYYY-MM-DD.
 * @returns {{ amount: number, type: 'expense'|'income', date: string, paymentMethod: string, description: string }|null}
 *   null se nel testo non c'è un importo.
 */
export function parseQuickEntry(text, today) {
  let rest = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!rest || rest.length > 200) return null;

  // «altro ieri» prima di «ieri»: altrimenti resterebbe «altro» nella descrizione.
  let date = today;
  for (const [re, days] of [...DATE_WORDS].reverse()) {
    if (re.test(rest)) { date = shiftDate(today, days); rest = rest.replace(re, ' '); break; }
  }

  // Più numeri («2 pizze 18»): vince quello con la valuta o i decimali, altrimenti il più grande.
  const found = [...rest.matchAll(AMOUNT_RE)];
  if (!found.length) return null;
  const marked = found.filter((x) => x[4] || /[.,]\d{1,2}$/.test(x[3]));
  const pool = marked.length ? marked : found;
  const m = pool.reduce((best, x) => (parseAmount(x[3]) > parseAmount(best[3]) ? x : best));
  const amount = parseAmount(m[3]);
  if (!amount || amount <= 0) return null;
  rest = (rest.slice(0, m.index) + rest.slice(m.index + m[0].length)).trim();

  let paymentMethod = DEFAULT_METHOD;
  for (const [re, method] of METHODS) {
    if (re.test(rest)) { paymentMethod = method; rest = rest.replace(re, ' '); break; }
  }

  const description = rest.replace(/\s+/g, ' ').trim().replace(/^[-–:,]\s*/, '');
  return {
    amount,
    type: m[2] === '+' ? 'income' : 'expense',
    date,
    paymentMethod,
    description: description || '',
  };
}
