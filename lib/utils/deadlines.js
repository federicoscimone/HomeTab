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

/** Le cadenze riconosciute: mesi fra un pagamento e l'altro e intervallo in giorni ammesso. */
const CADENCES = [
  { months: 1, min: 24, max: 38 },
  { months: 2, min: 50, max: 72 },
  { months: 3, min: 78, max: 103 },
  { months: 4, min: 108, max: 135 },
  { months: 6, min: 160, max: 205 },
  { months: 12, min: 330, max: 400 },
];
/** Importo simile: entro il 25% della mediana. Serve per le annuali e per dividere un esercente in fasce. */
const AMOUNT_TOLERANCE = 0.25;
/** Quota di intervalli che devono rientrare nella cadenza: un pagamento in ritardo non rompe la serie. */
const MIN_REGULAR = 0.75;
/** Oltre questo ritardo dalla data attesa, la spesa si considera finita. */
const ENDED_AFTER_DAYS = 45;
const TRANSFER_METHODS = ['bank_transfer', 'direct_debit'];
/** Parole da bolletta: con queste, anche una spesa annuale vista due volte è credibile. */
const BILL_WORDS_RE = /ASSICUR|POLIZZA|BOLLO|TARI\b|TASI|IMU\b|CANONE|RINNOV|ABBONAM|\bSDD\b|\bRID\b|DOMICILIAZ|ADDEBITO DIRETTO|CONDOMINI|RATA/i;
const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const similar = (amount, typical) => Math.abs(amount - typical) <= typical * AMOUNT_TOLERANCE;
const rawText = (m) => `${m.payee ?? ''} ${m.description ?? ''}`;

/**
 * Una serie: pagamenti in ordine di data, al più uno al mese. Restituisce la cadenza se è
 * regolare, altrimenti il motivo per cui non lo è.
 *
 * @returns {{ cadence?: object, reason?: 'few'|'irregular'|'yearlyUnconfirmed'|'amounts', variable?: boolean }}
 */
function analyzeSeries(series) {
  if (series.length < 2) return { reason: 'few' };
  const gaps = series.slice(1).map((m, i) => daysBetween(series[i].date, m.date));
  const typicalGap = median(gaps);
  const cadence = CADENCES.find((c) => typicalGap >= c.min && typicalGap <= c.max);
  if (!cadence) return { reason: 'irregular' };
  const regular = gaps.filter((g) => g >= cadence.min && g <= cadence.max).length;
  // Un intervallo doppio è un pagamento mancante nei dati, non un'altra cadenza: conta come regolare.
  const skipped = gaps.filter((g) => g >= cadence.min * 2 && g <= cadence.max * 2).length;
  if ((regular + skipped) / gaps.length < MIN_REGULAR || regular === 0) return { reason: 'irregular' };

  const typical = median(series.map((m) => m.amount));
  const stable = series.every((m) => similar(m.amount, typical));
  if (series.length === 2) {
    // Due pagamenti soli: credibile solo per una spesa annuale con importo simile e l'aria di una
    // bolletta (bonifico, addebito, o parole come «assicurazione», «bollo», «canone»).
    if (cadence.months < 12) return { reason: 'few' };
    if (!stable) return { reason: 'amounts' };
    const looksLikeBill = series.some((m) => TRANSFER_METHODS.includes(m.paymentMethod) || BILL_WORDS_RE.test(rawText(m)));
    if (!looksLikeBill) return { reason: 'yearlyUnconfirmed' };
  }
  return { cadence, variable: !stable };
}

/**
 * La chiave dell'esercente: le sue prime due parole significative. Un nome fatto di cifre e sigle
 * («A2A», «E.ON», «3») non ne ha: allora vale il nome com'è, in maiuscolo e senza punteggiatura.
 */
function merchantKey(m) {
  const tokens = merchantTokens(historyText(m)).slice(0, 2);
  if (tokens.length) return tokens.join(' ');
  return historyText(m).toUpperCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 30) || null;
}

/**
 * Una serie che sembra una spesa programmata: importi stabili, o l'aria di una bolletta. Solo
 * queste diventano «quasi riconosciute»: la pizzeria a importi sempre diversi è un'abitudine.
 */
function looksPlanned(series) {
  const typical = median(series.map((m) => m.amount));
  return series.every((m) => similar(m.amount, typical))
    || series.some((m) => TRANSFER_METHODS.includes(m.paymentMethod) || BILL_WORDS_RE.test(rawText(m)));
}

/** Le serie di un esercente: tutti insieme se paga una volta al mese, altrimenti per fascia d'importo. */
function seriesOf(list) {
  const byMonth = (items) => new Set(items.map((m) => m.date.slice(0, 7))).size === items.length;
  if (byMonth(list)) return [list];
  // Più pagamenti nello stesso mese: può essere la spesa di tutti i giorni (niente serie) o due
  // contratti con lo stesso esercente (luce e gas): si prova a dividerli per importo.
  const bands = [];
  for (const m of [...list].sort((a, b) => a.amount - b.amount)) {
    const band = bands.find((b) => similar(m.amount, median(b.map((x) => x.amount))));
    if (band) band.push(m); else bands.push([m]);
  }
  return bands.map((b) => b.sort((a, c) => a.date.localeCompare(c.date))).filter(byMonth);
}

/**
 * Spese che si ripetono a intervalli regolari dallo stesso esercente: bollette, abbonamenti,
 * rate, tasse, polizze. Più quelle quasi riconosciute, con il motivo, per capire cosa manca.
 *
 * @param {{ date: string, amount: number, payee?: string, description?: string, categoryId?: any, paymentMethod?: string }[]} movements
 * @param {string} today
 * @returns {{ found: object[], nearMisses: { title: string, occurrences: number, reason: string }[] }}
 */
export function analyzePeriodic(movements, today) {
  const groups = new Map();
  for (const m of movements) {
    const key = merchantKey(m);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const found = [];
  const nearMisses = [];
  for (const [key, all] of groups) {
    const list = [...all].sort((a, b) => a.date.localeCompare(b.date));
    const months = new Set(list.map((m) => m.date.slice(0, 7))).size;
    // La spesa di tutti i giorni (più di una volta al mese in media) non è una scadenza, e non
    // è nemmeno un «quasi»: non si mostra.
    if (list.length > months * 1.5 && seriesOf(list).every((s) => s.length < 3)) continue;

    const regular = [];
    let miss = null;
    // Divise per fasce perché pagate più volte al mese: dentro una fascia gli importi si somigliano
    // per costruzione, quindi non dicono nulla. Queste diventano proposte solo se regolari, mai «quasi».
    const banded = months !== list.length;
    for (const series of seriesOf(list)) {
      const result = analyzeSeries(series);
      if (result.cadence) {
        const last = series.at(-1);
        const nextDate = addMonthsToDate(last.date, result.cadence.months);
        if (daysBetween(nextDate, today) > ENDED_AFTER_DAYS) {
          if (!banded && looksPlanned(series)) miss ??= { series, reason: 'ended' };
          continue;
        }
        const recent = series.slice(-3).map((m) => m.amount);
        const candidate = {
          match: key,
          title: historyText(last),
          amount: round2(result.variable ? median(recent) : last.amount),
          variable: result.variable,
          everyMonths: result.cadence.months,
          nextDate,
          lastDate: last.date,
          categoryId: last.categoryId ?? null,
          occurrences: series.length,
        };
        regular.push(candidate);
      } else if (!banded && series.length >= 2 && result.reason !== 'few' && looksPlanned(series)) {
        miss ??= { series, reason: result.reason };
      }
    }
    if (regular.length) found.push(...regular);
    else if (miss) nearMisses.push({ title: historyText(miss.series.at(-1)), occurrences: miss.series.length, reason: miss.reason });
  }
  return {
    found: found.sort((a, b) => a.nextDate.localeCompare(b.nextDate)),
    nearMisses: nearMisses.sort((a, b) => b.occurrences - a.occurrences).slice(0, 8),
  };
}

/** Solo le spese riconosciute (vedi analyzePeriodic). */
export const detectPeriodic = (movements, today) => analyzePeriodic(movements, today).found;

/**
 * Un movimento che sembra il pagamento di una scadenza: esercente con le parole di `match`,
 * importo vicino, dai 20 giorni prima della scadenza a oggi.
 */
export function findPayment(deadline, movements, today) {
  const words = merchantTokens(deadline.match || deadline.title);
  const plain = (text) => String(text ?? '').toUpperCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const fallback = plain(deadline.match || deadline.title);
  if (!words.length && !fallback) return null;
  const from = addDays(deadline.nextDate, -20);
  return movements
    .filter((m) => m.date >= from && m.date <= today)
    .filter((m) => {
      // Senza parole significative («A2A»), basta che il nome compaia nel testo del movimento.
      if (!words.length) return ` ${plain(rawText(m))} `.includes(` ${fallback} `);
      const tokens = merchantTokens(historyText(m));
      return words.every((w) => tokens.includes(w));
    })
    .filter((m) => !(deadline.amount > 0) || Math.abs(m.amount - deadline.amount) <= deadline.amount * AMOUNT_TOLERANCE)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}
