/**
 * @fileoverview Calcoli sulle scadenze: date, quote da accantonare, promemoria, e il
 * riconoscimento delle spese che si ripetono a intervalli lunghi.
 * @module lib/utils/deadlines
 *
 * Solo funzioni pure, provate nei test. Le date sono stringhe YYYY-MM-DD come nei movimenti.
 */

import { historyText, merchantTokens } from './merchantHistory.js';

export const DEADLINE_KINDS = ['bill', 'tax', 'insurance', 'subscription', 'loan', 'other'];
/** Ogni quanti mesi si ripete; null = una volta sola. */
export const PERIODS = [1, 2, 3, 4, 6, 12, 24];

const DAY_MS = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');
const round2 = (v) => Math.round(v * 100) / 100;
const toUtc = (date) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));

/** Giorni da `from` a `to` (negativo se `to` è prima). */
export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

export function addDays(date, n) {
  const d = new Date(toUtc(date) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Aggiunge mesi tenendo il giorno, o l'ultimo del mese se non esiste (31 gennaio → 28 febbraio). */
export function addMonthsToDate(date, n) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + n;
  const day = Number(date.slice(8, 10));
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(day, last))}`;
}

/**
 * Quanto mettere da parte ogni mese per una scadenza non mensile: la spesa divisa per i mesi
 * fra un pagamento e l'altro. Le mensili stanno già nelle uscite di ogni mese.
 */
export function monthlyReserve({ amount, everyMonths, active = true }) {
  if (!active || !(amount > 0) || !(everyMonths >= 2)) return 0;
  return round2(amount / everyMonths);
}

/**
 * La scadenza dopo il pagamento: avanza di un periodo (anche più d'uno, se era rimasta indietro),
 * o si chiude se era una tantum.
 *
 * @returns {{ nextDate: string, active: boolean }}
 */
export function advance({ nextDate, everyMonths }, today) {
  if (!everyMonths) return { nextDate, active: false };
  let next = addMonthsToDate(nextDate, everyMonths);
  // Segnata pagata con più periodi di ritardo: la prossima è comunque la prima nel futuro.
  while (next < today) next = addMonthsToDate(next, everyMonths);
  return { nextDate: next, active: true };
}

/**
 * Quale promemoria va mandato oggi, se uno: il preavviso entrando nella finestra, poi il giorno
 * della scadenza (o il primo giorno utile dopo, se non è stata segnata pagata).
 *
 * @returns {'before'|'due'|null}
 */
export function reminderStage({ active, remindDays, nextDate, notified = [] }, today) {
  if (!active || !remindDays) return null;
  const left = daysBetween(today, nextDate);
  if (left <= 0) return notified.includes('due') ? null : 'due';
  if (left <= remindDays && !notified.includes('before')) return 'before';
  return null;
}

/** Le scadenze dei prossimi `days` giorni (e quelle passate non segnate pagate), in ordine. */
export function upcoming(deadlines, today, days) {
  return deadlines
    .filter((d) => d.active && daysBetween(today, d.nextDate) <= days)
    .map((d) => ({ ...d, daysLeft: daysBetween(today, d.nextDate) }))
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/** Intervalli riconosciuti, in giorni fra un pagamento e l'altro. */
const CADENCES = [
  { months: 12, min: 330, max: 400, occurrences: 2 },
  { months: 6, min: 165, max: 200, occurrences: 3 },
  { months: 3, min: 80, max: 100, occurrences: 3 },
  { months: 2, min: 52, max: 70, occurrences: 4 },
];
const AMOUNT_TOLERANCE = 0.25;
const TRANSFER_METHODS = ['bank_transfer', 'direct_debit'];
const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Spese che si ripetono ogni 2, 3, 6 o 12 mesi dallo stesso esercente con un importo simile:
 * bollo, assicurazione, TARI, rinnovi. Le mensili le trovano già i consigli di risparmio.
 *
 * @param {{ date: string, amount: number, payee?: string, description?: string, categoryId?: any, paymentMethod?: string }[]} movements
 * @param {string} today
 * @returns {{ match: string, title: string, amount: number, everyMonths: number, nextDate: string, lastDate: string, categoryId: any, occurrences: number }[]}
 */
export function detectPeriodic(movements, today) {
  const groups = new Map();
  for (const m of movements) {
    const tokens = merchantTokens(historyText(m)).slice(0, 2);
    if (!tokens.length) continue;
    const key = tokens.join(' ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const out = [];
  for (const [key, list] of groups) {
    const typical = median(list.map((m) => m.amount));
    const same = list
      .filter((m) => Math.abs(m.amount - typical) <= typical * AMOUNT_TOLERANCE)
      .sort((a, b) => a.date.localeCompare(b.date));
    // Più pagamenti nello stesso mese (rate, acquisti) non sono una scadenza periodica.
    const months = new Set(same.map((m) => m.date.slice(0, 7)));
    if (months.size !== same.length || same.length < 2) continue;
    const gaps = same.slice(1).map((m, i) => daysBetween(same[i].date, m.date));
    // Bonifici e addebiti diretti sono il modo in cui si pagano bollette, tasse e polizze: due
    // volte bastano. Con carta o contanti servono tre ripetizioni, altrimenti il panettone di
    // Natale o la spiaggia d'agosto sembrerebbero scadenze annuali.
    const byTransfer = same.filter((m) => TRANSFER_METHODS.includes(m.paymentMethod)).length * 2 > same.length;
    const minOccurrences = (c) => (byTransfer ? c.occurrences : Math.max(c.occurrences, 3));
    const cadence = CADENCES.find((c) => same.length >= minOccurrences(c) && gaps.every((g) => g >= c.min && g <= c.max));
    if (!cadence) continue;
    const last = same.at(-1);
    const nextDate = addMonthsToDate(last.date, cadence.months);
    // Attesa da poco e non ancora pagata: resta lì, scaduta. Passata da molto: la spesa è finita.
    if (daysBetween(nextDate, today) > 45) continue;
    out.push({
      match: key,
      title: historyText(last),
      amount: round2(last.amount),
      everyMonths: cadence.months,
      nextDate,
      lastDate: last.date,
      categoryId: last.categoryId ?? null,
      occurrences: same.length,
    });
  }
  return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/**
 * Un movimento che sembra il pagamento di una scadenza: esercente con le parole di `match`,
 * importo vicino, dai 20 giorni prima della scadenza a oggi.
 */
export function findPayment(deadline, movements, today) {
  const words = merchantTokens(deadline.match || deadline.title);
  if (!words.length) return null;
  const from = addDays(deadline.nextDate, -20);
  return movements
    .filter((m) => m.date >= from && m.date <= today)
    .filter((m) => {
      const tokens = merchantTokens(historyText(m));
      return words.every((w) => tokens.includes(w));
    })
    .filter((m) => !(deadline.amount > 0) || Math.abs(m.amount - deadline.amount) <= deadline.amount * AMOUNT_TOLERANCE)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}
