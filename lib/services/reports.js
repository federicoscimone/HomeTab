/**
 * @fileoverview I calcoli dei report, condivisi da route e agente.
 * @module lib/services/reports
 *
 * Prima stavano dentro le route: per far rispondere l'agente della chat con gli stessi numeri
 * della dashboard bisognava poterli chiamare da fuori. Le route ora leggono i parametri, chiamano
 * queste funzioni e restituiscono il risultato così com'è; l'agente le chiama dai suoi strumenti.
 *
 * Le funzioni ricevono parametri già validati e l'etichetta dei movimenti senza categoria, che è
 * testo dell'interfaccia e quindi nella lingua di chi chiede.
 */

import { comparisonPeriods, sameDayPreviousYear, todayString } from '../utils/comparePeriods.js';
import { projectYear } from '../utils/yearProjection.js';
import mongoose from 'mongoose';
import Movement from '../models/Movement.js';
import Category from '../models/Category.js';

const UNCATEGORIZED_COLOR = '#94a3b8';
const excludeFilter = { excludeFromAnalysis: { $ne: true } };
const pad = (n) => String(n).padStart(2, '0');

/**
 * Riepilogo di un mese per la dashboard: totali, confronto con il mese prima, categorie, metodi,
 * andamento degli ultimi sei mesi.
 *
 * @param {{ year: number, month: number, paymentGroup?: 'traditional'|'alternative'|'all', uncategorized: string }} p
 */
export async function monthSummary({ year, month, paymentGroup = 'traditional', uncategorized }) {
  // Mese corrente e precedente in formato YYYY-MM-DD
  const curFrom = `${year}-${pad(month)}-01`;
  const curTo   = `${year}-${pad(month)}-31`;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const prevFrom  = `${prevYear}-${pad(prevMonth)}-01`;

  // Mese in corso: il confronto è con gli stessi giorni del mese prima. Il 7 ottobre una settimana
  // di spese contro settembre intero dava sempre un calo (-52%), qualunque cosa fosse successo.
  // Il giorno si ferma alla fine del mese precedente: il 31 marzo si confronta con tutto febbraio.
  const today = todayString();
  const inProgress = today >= curFrom && today <= curTo;
  const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const prevToDay = inProgress ? Math.min(Number(today.slice(8)), daysInPrevMonth) : null;
  const prevTo    = `${prevYear}-${pad(prevMonth)}-${prevToDay ? pad(prevToDay) : '31'}`;

  const paymentGroupFilter = paymentGroup === 'all' ? {} : { paymentGroup };

  const [curExpenses, prevExpenses] = await Promise.all([
    Movement.find({ date: { $gte: curFrom, $lte: curTo }, ...excludeFilter, ...paymentGroupFilter })
      .populate('categoryId', 'name color')
      .lean(),
    Movement.find({ date: { $gte: prevFrom, $lte: prevTo }, ...excludeFilter, ...paymentGroupFilter })
      .lean(),
  ]);

  const sum = (list, income) => list.filter((e) => (e.type === 'income') === income).reduce((s, e) => s + e.amount, 0);

  // Uscite per categoria (con split tradizionale/alternativo)
  const byCategoryMap = {};
  for (const e of curExpenses.filter((x) => x.type !== 'income')) {
    const key = e.categoryId?._id?.toString() || 'uncategorized';
    if (!byCategoryMap[key]) {
      byCategoryMap[key] = {
        categoryId: e.categoryId?._id?.toString() || null,
        name: e.categoryId?.name || uncategorized,
        color: e.categoryId?.color || UNCATEGORIZED_COLOR,
        amount: 0,
        traditional: 0,
        alternative: 0,
      };
    }
    byCategoryMap[key].amount += e.amount;
    if (e.paymentGroup === 'alternative') byCategoryMap[key].alternative += e.amount;
    else byCategoryMap[key].traditional += e.amount;
  }
  const byCategory = Object.values(byCategoryMap).sort((a, b) => b.amount - a.amount).slice(0, 8);

  // Entrate per categoria
  const byIncomeCategoryMap = {};
  for (const e of curExpenses.filter((x) => x.type === 'income')) {
    const key = e.categoryId?._id?.toString() || 'uncategorized';
    if (!byIncomeCategoryMap[key]) {
      byIncomeCategoryMap[key] = {
        categoryId: e.categoryId?._id?.toString() || null,
        name: e.categoryId?.name || uncategorized,
        color: e.categoryId?.color || UNCATEGORIZED_COLOR,
        amount: 0,
      };
    }
    byIncomeCategoryMap[key].amount += e.amount;
  }
  const byIncomeCategory = Object.values(byIncomeCategoryMap).sort((a, b) => b.amount - a.amount).slice(0, 8);

  // Metodi pagamento (solo uscite)
  const byMethodMap = {};
  for (const e of curExpenses.filter((x) => x.type !== 'income')) {
    byMethodMap[e.paymentMethod] = (byMethodMap[e.paymentMethod] || 0) + e.amount;
  }
  const byMethod = Object.entries(byMethodMap)
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Tradizionale vs Alternativo
  const groupSum = (group) => curExpenses
    .filter((e) => e.type !== 'income' && e.paymentGroup === group)
    .reduce((s, e) => s + e.amount, 0);

  // Ultimi 6 mesi — andamento uscite/entrate. Una sola query per tutto l'intervallo invece di
  // una per mese: sei andate e ritorni verso Atlas pesavano sul tempo di risposta.
  // Il mese esce come YYYY-MM: il nome lo scrive il browser, nella lingua dell'interfaccia.
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 6 + i, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  });
  const trendDocs = await Movement.find({
    date: { $gte: `${trendMonths[0]}-01`, $lte: `${trendMonths[5]}-31` }, ...excludeFilter, ...paymentGroupFilter,
  }).select('date type amount').lean();
  const trend = trendMonths.map((m) => ({ month: m, expense: 0, income: 0 }));
  const trendIndex = new Map(trendMonths.map((m, i) => [m, i]));
  for (const e of trendDocs) {
    const point = trend[trendIndex.get(e.date.slice(0, 7))];
    if (!point) continue;
    if (e.type === 'income') point.income += e.amount;
    else point.expense += e.amount;
  }

  return {
    month, year,
    paymentGroup,
    current:  { totalExpense: sum(curExpenses, false), totalIncome: sum(curExpenses, true), count: curExpenses.length },
    // toDay: ultimo giorno del mese precedente usato nel confronto, null se è il mese intero.
    previous: { totalExpense: sum(prevExpenses, false), totalIncome: sum(prevExpenses, true), toDay: prevToDay },
    byCategory,
    byIncomeCategory,
    byMethod,
    paymentGroups: { traditional: groupSum('traditional'), alternative: groupSum('alternative') },
    trend,
  };
}

/**
 * Report per categoria con il confronto sull'anno prima (vedi lib/utils/comparePeriods.js per le
 * due basi di confronto, `period` e `full`).
 *
 * @param {{ year: number, month?: number|null, type?: 'expense'|'income', paymentGroup?: string,
 *   categoryId?: string|null, compare?: 'period'|'full' }} p
 */
export async function categoryReport({ year, month = null, type = 'expense', paymentGroup = '', categoryId = null, compare = 'period' }) {
  const periods = comparisonPeriods(year, month, todayString());
  const cutoffMonth = periods.cutoff ? parseInt(periods.cutoff.split('-')[1], 10) : 13;

  const categories = await Category.find({ level: 1 }).sort({ name: 1 }).lean();
  const catsToProcess = categoryId ? categories.filter((c) => c._id.toString() === categoryId) : categories;
  const result = [];

  for (const cat of catsToProcess) {
    const baseFilter = {
      $or: [{ categoryId: cat._id }, { subCategory1Id: cat._id }],
      type,
      ...excludeFilter,
    };
    if (paymentGroup) baseFilter.paymentGroup = paymentGroup;

    const [curExp, prevExp] = await Promise.all([
      Movement.find({ ...baseFilter, date: { $gte: periods.current.from, $lte: periods.current.to } }).lean(),
      Movement.find({ ...baseFilter, date: { $gte: periods.previousFull.from, $lte: periods.previousFull.to } }).lean(),
    ]);

    if (curExp.length === 0 && prevExp.length === 0) continue;

    const totalCur        = curExp.reduce((s, e) => s + e.amount, 0);
    const totalPrevFull   = prevExp.reduce((s, e) => s + e.amount, 0);
    const totalPrevToDate = prevExp.filter((e) => e.date <= periods.previousToDate.to).reduce((s, e) => s + e.amount, 0);
    const totalPrev = compare === 'full' ? totalPrevFull : totalPrevToDate;

    const catResult = {
      categoryId:   cat._id.toString(),
      categoryName: cat.name,
      color:        cat.color,
      totalCur,
      totalPrev,
      totalPrevToDate,
      totalPrevFull,
      deltaAbs: totalCur - totalPrev,
      deltaPct: totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null,
    };

    // Senza filtro per mese: andamento mensile e media
    if (!month) {
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        // I mesi dopo oggi non sono a zero: non sono ancora arrivati.
        const cur = m > cutoffMonth
          ? null
          : curExp.filter((e) => parseInt(e.date.split('-')[1], 10) === m).reduce((s, e) => s + e.amount, 0);
        const prevOfMonth = prevExp.filter((e) => parseInt(e.date.split('-')[1], 10) === m);
        const prev = prevOfMonth.reduce((s, e) => s + e.amount, 0);
        if (m !== cutoffMonth) return { month: m, cur, prev };
        // Il mese in corso porta anche l'anno prima fino allo stesso giorno, per confrontarlo alla pari.
        const prevToDate = prevOfMonth.filter((e) => e.date <= periods.previousToDate.to).reduce((s, e) => s + e.amount, 0);
        return { month: m, cur, prev, prevToDate, partial: true };
      });
      // Media sui mesi chiusi con movimenti: il mese in corso, con pochi giorni di spese, la
      // abbassava (al 7 ottobre la spesa alimentare media risultava 688 € invece di 749 €).
      const closed = monthly.filter((m) => !m.partial && m.cur > 0);
      catResult.monthly = monthly;
      catResult.avg = closed.length ? closed.reduce((s, m) => s + m.cur, 0) / closed.length : null;
    }

    result.push(catResult);
  }

  result.sort((a, b) => b.totalCur - a.totalCur);

  const response = { year, type, compare, cutoff: periods.cutoff, categories: result };
  if (paymentGroup) response.paymentGroup = paymentGroup;
  if (month) response.month = month;
  return response;
}

function groupByCategory(expenses, uncategorized) {
  const map = {};
  for (const e of expenses) {
    const id = e.categoryId?._id?.toString() || 'uncategorized';
    if (!map[id]) map[id] = { name: e.categoryId?.name || uncategorized, color: e.categoryId?.color || UNCATEGORIZED_COLOR, amount: 0 };
    map[id].amount += e.amount;
  }
  return map;
}

function getYearWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(weekNo)}`;
}

/**
 * Analisi di un intervallo di date con lo stesso periodo dell'anno prima, l'andamento per
 * settimana e la proiezione dell'anno in corso.
 *
 * @param {{ from: string, to: string, type?: 'expense'|'income', paymentGroup?: string, uncategorized: string }} p
 */
export async function rangeAnalysis({ from, to, type = 'expense', paymentGroup = '', uncategorized }) {
  // Stesso periodo anno precedente. Con setFullYear il 29 febbraio diventava il 1° marzo,
  // allargando il periodo di confronto di un giorno.
  const prevFromStr = sameDayPreviousYear(from);
  const prevToStr   = sameDayPreviousYear(to);

  const baseFilter = { type, ...excludeFilter };
  if (paymentGroup) baseFilter.paymentGroup = paymentGroup;

  const [curExp, prevExp] = await Promise.all([
    Movement.find({ ...baseFilter, date: { $gte: from, $lte: to } }).populate('categoryId', 'name color').lean(),
    Movement.find({ ...baseFilter, date: { $gte: prevFromStr, $lte: prevToStr } }).populate('categoryId', 'name color').lean(),
  ]);

  const totalCur  = curExp.reduce((s, e) => s + e.amount, 0);
  const totalPrev = prevExp.reduce((s, e) => s + e.amount, 0);

  const byCatCur  = groupByCategory(curExp, uncategorized);
  const byCatPrev = groupByCategory(prevExp, uncategorized);
  const allCatIds = new Set([...Object.keys(byCatCur), ...Object.keys(byCatPrev)]);

  const byCategory = [...allCatIds].map((id) => {
    const cur  = byCatCur[id] || { name: uncategorized, color: UNCATEGORIZED_COLOR, amount: 0 };
    const prev = byCatPrev[id] || { amount: 0 };
    const delta = cur.amount - prev.amount;
    const pct   = prev.amount > 0 ? (delta / prev.amount) * 100 : null;
    return { id, name: cur.name, color: cur.color, cur: cur.amount, prev: prev.amount, delta, pct };
  }).sort((a, b) => b.cur - a.cur);

  // Proiezione a fine anno dell'anno in corso, indipendente dal periodo selezionato: speso
  // finora più la media dei mesi chiusi per i giorni che mancano (vedi lib/utils/yearProjection).
  const today   = todayString();
  const yearExp = await Movement.find({ ...baseFilter, date: { $gte: `${today.slice(0, 4)}-01-01`, $lte: today } })
    .select('date amount').lean();
  const projection = { ...projectYear(yearExp, today), today };

  // Andamento per settimana nel range selezionato
  const weeklyMap = {};
  for (const e of curExp) {
    const yw = getYearWeek(new Date(e.date));
    weeklyMap[yw] = (weeklyMap[yw] || 0) + e.amount;
  }
  const weekly = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, amount]) => ({ week, amount }));

  return {
    from, to, type,
    paymentGroup: paymentGroup || 'all',
    prevFrom: prevFromStr, prevTo: prevToStr,
    totalCur, totalPrev,
    deltaAbs: totalCur - totalPrev,
    deltaPct: totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null,
    byCategory,
    weekly,
    projection,
  };
}

/**
 * Matrice categoria × mese di un anno, con totali e medie sui mesi trascorsi.
 *
 * @param {{ year: number, type?: 'expense'|'income', paymentGroup?: string, uncategorized: string }} p
 */
export async function pivotReport({ year, type = 'expense', paymentGroup = '', uncategorized }) {
  const currentDate  = new Date();
  const isCurrentYear = year === currentDate.getFullYear();
  const daysInCurrentMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const daysToMonthEnd = daysInCurrentMonth - currentDate.getDate();
  const includeCurrentMonth = daysToMonthEnd < 3;
  const elapsedMonths = isCurrentYear ? currentDate.getMonth() + (includeCurrentMonth ? 1 : 0) : 12;

  const filter = { date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` }, type, ...excludeFilter };
  if (paymentGroup) filter.paymentGroup = paymentGroup;

  const [expenses, categories] = await Promise.all([
    Movement.find(filter).lean(),
    Category.find({ level: 1 }).sort({ name: 1 }).lean(),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const matrix = {};
  const monthTotals = {};
  months.forEach((m) => { monthTotals[m] = 0; });

  for (const exp of expenses) {
    const m     = parseInt(exp.date.split('-')[1], 10);
    const catId = exp.categoryId?.toString() || 'uncategorized';
    if (!matrix[catId]) matrix[catId] = { monthly: {}, total: 0 };
    matrix[catId].monthly[m] = (matrix[catId].monthly[m] || 0) + exp.amount;
    matrix[catId].total += exp.amount;
    monthTotals[m] += exp.amount;
  }

  const catMap = {};
  for (const c of categories) catMap[c._id.toString()] = c;

  // Media dei mesi trascorsi: numeratore e denominatore sugli stessi mesi. Prima il totale
  // includeva i primi giorni del mese in corso ma si divideva solo per i mesi chiusi, e l'affitto
  // di ottobre, pagato il primo del mese, gonfiava la media dell'11%.
  const elapsedAvg = (byMonth) => (elapsedMonths > 0
    ? months.filter((m) => m <= elapsedMonths).reduce((s, m) => s + (byMonth[m] || 0), 0) / elapsedMonths
    : null);

  const rows = Object.entries(matrix)
    .map(([catId, data]) => ({
      categoryId:   catId,
      categoryName: catMap[catId]?.name || uncategorized,
      color:        catMap[catId]?.color || UNCATEGORIZED_COLOR,
      monthly:      data.monthly,
      total:        data.total,
      avg:          data.total / 12,
      avgElapsed:   elapsedAvg(data.monthly),
    }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = Object.values(monthTotals).reduce((s, v) => s + v, 0);

  return {
    year,
    type,
    rows,
    monthTotals,
    grandTotal,
    months,
    isCurrentYear,
    elapsedMonths,
    grandAvgElapsed: elapsedAvg(monthTotals),
  };
}

/**
 * Totali per categoria (livello 1) in un intervallo qualsiasi, per confrontare due periodi scelti
 * liberamente. Stesse regole degli altri report: esclusi i movimenti fuori analisi.
 *
 * @param {{ from: string, to: string, type?: 'expense'|'income', paymentGroup?: string, uncategorized: string }} p
 * @returns {Promise<{ from: string, to: string, total: number, count: number,
 *   byCategory: { id: string, name: string, amount: number }[] }>}
 */
export async function totalsByCategory({ from, to, type = 'expense', paymentGroup = '', uncategorized }) {
  const filter = { date: { $gte: from, $lte: to }, type, ...excludeFilter };
  if (paymentGroup) filter.paymentGroup = paymentGroup;
  const docs = await Movement.find(filter).populate('categoryId', 'name color').select('amount categoryId').lean();
  const map = groupByCategory(docs, uncategorized);
  return {
    from, to,
    total: docs.reduce((s, e) => s + e.amount, 0),
    count: docs.length,
    byCategory: Object.entries(map).map(([id, c]) => ({ id, name: c.name, amount: c.amount })).sort((a, b) => b.amount - a.amount),
  };
}

/**
 * Totale di una sottocategoria con il confronto sull'anno prima, con le stesse due basi di
 * categoryReport: il report per categoria mostra solo le categorie principali, e «quanto in
 * ristoranti» riguarda una sottocategoria.
 *
 * @param {{ year: number, month?: number|null, type?: 'expense'|'income', paymentGroup?: string,
 *   subCategoryId: string, compare?: 'period'|'full' }} p
 */
export async function subcategoryReport({ year, month = null, type = 'expense', paymentGroup = '', subCategoryId, compare = 'period' }) {
  const periods = comparisonPeriods(year, month, todayString());
  // aggregate() non converte le stringhe in ObjectId come fa find(): va fatto qui.
  const base = { subCategory1Id: new mongoose.Types.ObjectId(subCategoryId), type, ...excludeFilter };
  if (paymentGroup) base.paymentGroup = paymentGroup;
  const sumOf = async (from, to) => {
    const [r] = await Movement.aggregate([
      { $match: { ...base, date: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    return { total: r?.total ?? 0, count: r?.count ?? 0 };
  };
  const [cur, prevToDate, prevFull] = await Promise.all([
    sumOf(periods.current.from, periods.current.to),
    sumOf(periods.previousToDate.from, periods.previousToDate.to),
    sumOf(periods.previousFull.from, periods.previousFull.to),
  ]);
  const totalPrev = compare === 'full' ? prevFull.total : prevToDate.total;
  return {
    year, month, type, compare, cutoff: periods.cutoff,
    current: { from: periods.current.from, to: periods.current.to, ...cur },
    previous: compare === 'full'
      ? { from: periods.previousFull.from, to: periods.previousFull.to, ...prevFull }
      : { from: periods.previousToDate.from, to: periods.previousToDate.to, ...prevToDate },
    deltaAbs: cur.total - totalPrev,
    deltaPct: totalPrev > 0 ? ((cur.total - totalPrev) / totalPrev) * 100 : null,
  };
}
