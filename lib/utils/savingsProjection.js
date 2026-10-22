/**
 * @fileoverview Quanto avrete risparmiato a fine anno continuando così.
 * @module lib/utils/savingsProjection
 *
 * Entrate e uscite si proiettano separatamente, mese per mese:
 * - mesi chiusi: i dati veri;
 * - mesi che mancano: lo stesso mese dell'anno scorso, moltiplicato per quanto quest'anno sta
 *   andando rispetto all'anno scorso nei mesi chiusi. È ciò che fa entrare la tredicesima di
 *   dicembre o le vacanze d'agosto, che una media piatta perderebbe. Senza l'anno scorso si usa la
 *   media dei mesi chiusi;
 * - «quanto sta andando» è la mediana dei rapporti mese per mese, non il rapporto dei totali:
 *   un'entrata una tantum (una vendita, un rimborso grosso) sta in un mese solo e non sposta la
 *   mediana, mentre nel totale gonfiava tutti i mesi che restano (25.000 € a marzo facevano salire
 *   il risparmio previsto di 33.000 €). Un cambiamento vero e duraturo, come un aumento di
 *   stipendio, sposta invece la maggior parte dei mesi, e quindi la mediana;
 * - mese in corso: il maggiore fra quanto registrato finora e la stima del mese, così uno stipendio
 *   non ancora arrivato non sparisce e uno già arrivato non si conta due volte.
 *
 * A gennaio senza dati dell'anno scorso non c'è niente su cui stimare: la proiezione è null.
 * La proiezione delle sole uscite in Analisi avanzata (yearProjection.js) resta la media dei mesi
 * chiusi, più semplice e adatta a un intervallo qualsiasi.
 */

/** Il rapporto con l'anno scorso si tiene in un intervallo ragionevole: un anno anomalo non deve
 *  raddoppiare né dimezzare tutti i mesi che restano. */
const MIN_RATIO = 0.5;
const MAX_RATIO = 2;

const round2 = (v) => Math.round(v * 100) / 100;

/** La mediana: per un numero pari di valori, la media dei due centrali. */
function median(values) {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
const pad = (n) => String(n).padStart(2, '0');
const key = (year, month) => `${year}-${pad(month)}`;

/**
 * @param {Record<string, { income: number, expense: number }>} byMonth - Totali per mese
 *   (YYYY-MM), almeno dall'inizio dell'anno scorso.
 * @param {string} today - YYYY-MM-DD.
 * @param {string|null} firstDataMonth - Primo mese con movimenti (YYYY-MM): prima i mesi mancano,
 *   non sono a zero.
 */
export function projectSavings(byMonth, today, firstDataMonth) {
  const year = Number(today.slice(0, 4));
  const current = Number(today.slice(5, 7));
  const has = (m) => firstDataMonth != null && m >= firstDataMonth;
  const value = (m, field) => byMonth[m]?.[field] ?? 0;

  const closed = Array.from({ length: current - 1 }, (_, i) => key(year, i + 1));
  const lastYearCovered = (months) => months.every((m) => has(`${year - 1}${m.slice(4)}`));

  /** Stima di un mese per un campo, e se viene dall'anno scorso o dalla media. */
  const estimator = (field) => {
    const thisYear = closed.reduce((s, m) => s + value(m, field), 0);
    let ratio = 1;
    if (closed.length && lastYearCovered(closed)) {
      // I mesi dell'anno scorso a zero non dicono nulla sul rapporto: si saltano.
      const monthly = closed
        .map((m) => [value(m, field), value(`${year - 1}${m.slice(4)}`, field)])
        .filter(([, last]) => last > 0)
        .map(([cur, last]) => cur / last);
      const mid = median(monthly);
      if (mid != null) ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, mid));
    }
    const average = closed.length ? thisYear / closed.length : null;
    return (month) => {
      const prev = key(year - 1, month);
      if (has(prev) && (!closed.length || lastYearCovered(closed))) {
        return { value: value(prev, field) * ratio, method: 'seasonal' };
      }
      return average == null ? null : { value: average, method: 'average' };
    };
  };
  const estimate = { income: estimator('income'), expense: estimator('expense') };

  const months = [];
  let method = null;
  for (let m = 1; m <= 12; m += 1) {
    const k = key(year, m);
    if (m < current) {
      months.push({ month: k, kind: 'actual', income: value(k, 'income'), expense: value(k, 'expense') });
      continue;
    }
    const ei = estimate.income(m);
    const ee = estimate.expense(m);
    if (!ei || !ee) return null;
    method = method === 'average' || ei.method === 'average' || ee.method === 'average' ? 'average' : 'seasonal';
    if (m === current) {
      months.push({
        month: k, kind: 'current',
        income: Math.max(value(k, 'income'), ei.value), expense: Math.max(value(k, 'expense'), ee.value),
        actualIncome: value(k, 'income'), actualExpense: value(k, 'expense'),
      });
    } else {
      months.push({ month: k, kind: 'estimate', income: ei.value, expense: ee.value });
    }
  }

  const sum = (list, f) => round2(list.reduce((s, x) => s + x[f], 0));
  const ytd = months.filter((x) => x.kind === 'actual');
  const cur = months.find((x) => x.kind === 'current');
  const actualIncome = sum(ytd, 'income') + (cur?.actualIncome ?? 0);
  const actualExpense = sum(ytd, 'expense') + (cur?.actualExpense ?? 0);
  const projectedIncome = sum(months, 'income');
  const projectedExpense = sum(months, 'expense');

  const lastYearMonths = Array.from({ length: 12 }, (_, i) => key(year - 1, i + 1));
  const lastYear = lastYearMonths.every(has) ? {
    income: round2(lastYearMonths.reduce((s, m) => s + value(m, 'income'), 0)),
    expense: round2(lastYearMonths.reduce((s, m) => s + value(m, 'expense'), 0)),
  } : null;

  return {
    year,
    today,
    method,
    actual: { income: round2(actualIncome), expense: round2(actualExpense), savings: round2(actualIncome - actualExpense) },
    projected: { income: projectedIncome, expense: projectedExpense, savings: round2(projectedIncome - projectedExpense) },
    lastYear: lastYear && { ...lastYear, savings: round2(lastYear.income - lastYear.expense) },
    months: months.map((x) => ({ month: x.month, kind: x.kind, savings: round2(x.income - x.expense) })),
  };
}
