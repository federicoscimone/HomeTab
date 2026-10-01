/**
 * @fileoverview Calcolo puro degli obiettivi di risparmio: ripartizione mensile e proiezioni.
 *
 * Nessuna dipendenza da database o alias `@/`: il modulo riceve dati già aggregati e
 * restituisce numeri, così si può testare con `node --test` senza avviare nulla.
 *
 * Modello contabile — ogni euro risparmiato sta in un obiettivo oppure nel "risparmio libero":
 *
 *   Σ disponibile(obiettivi) + libero = Σ già accantonato iniziale + Σ risparmio netto − Σ spese collegate
 *
 * Il risparmio di un mese chiuso viene diviso secondo il piano di ripartizione in vigore in
 * quel mese; la quota non assegnata finisce nel libero. Il calcolo si rifà da zero a ogni
 * richiesta invece di salvare snapshot mensili: gli estratti conto vengono importati in
 * ritardo, e un import che modifica un mese passato deve correggere da solo gli obiettivi.
 *
 * @module lib/utils/goalMath
 */

/** Tolleranza per confronti tra importi in euro (mezzo centesimo). */
const EPSILON = 0.005;

// ── Mesi in formato 'YYYY-MM' ─────────────────────────────────────────────────

/**
 * @param {Date} date
 * @returns {string} Mese in formato 'YYYY-MM' (ora locale del server).
 */
export function monthOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {Date} date
 * @returns {string} Data in formato 'YYYY-MM-DD' (ora locale del server).
 */
export function dayOf(date) {
  return `${monthOf(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * @param {string} month - 'YYYY-MM'.
 * @param {number} n     - Mesi da aggiungere (anche negativi).
 * @returns {string} 'YYYY-MM'.
 */
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * @param {string} from - 'YYYY-MM'.
 * @param {string} to   - 'YYYY-MM'.
 * @returns {number} Numero di mesi da `from` a `to` (0 se uguali, negativo se `to` precede).
 */
export function monthDiff(from, to) {
  const [y1, m1] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Arrotonda al centesimo, per non propagare errori di virgola mobile nelle risposte. */
const round2 = (v) => Math.round(v * 100) / 100;

// ── Tipi ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} GoalInput
 * @property {string}      id
 * @property {string}      name
 * @property {number}      targetAmount
 * @property {string}      deadline      - 'YYYY-MM': ultimo mese utile per accantonare.
 * @property {number}      initialAmount - Soldi già da parte alla creazione.
 * @property {string}      createdMonth  - 'YYYY-MM'.
 * @property {'active'|'completed'|'cancelled'} status
 * @property {string|null} closedMonth   - Da questo mese in poi non riceve più quote.
 * @property {string|null} transferTo    - Solo per 'cancelled': obiettivo che riceve il disponibile.
 */

/**
 * @typedef {Object} PlanInput
 * @property {string} effectiveFrom - 'YYYY-MM'.
 * @property {{goalId: string, pct: number}[]} shares
 */

/**
 * @typedef {Object} ComputeInput
 * @property {GoalInput[]} goals
 * @property {PlanInput[]} plans
 * @property {Object<string, number>} savingsByMonth - Risparmio netto per mese chiuso ('YYYY-MM' → €),
 *   già al netto delle spese collegate agli obiettivi.
 * @property {{goalId: string, month: string, amount: number}[]} linkedExpenses
 * @property {string}      currentMonth     - Mese in corso, non ancora ripartito.
 * @property {string|null} firstDataMonth   - Primo mese con movimenti, per la media.
 * @property {number}      [currentMonthSavings=0] - Risparmio provvisorio del mese in corso.
 * @property {number}      [avgWindow=6]   - Mesi chiusi su cui calcolare la media.
 */

// ── Ripartizione ──────────────────────────────────────────────────────────────

/**
 * Restituisce il piano in vigore in un mese: l'ultima versione con `effectiveFrom` ≤ mese.
 *
 * @param {PlanInput[]} sortedPlans - Ordinati per effectiveFrom crescente.
 * @param {string}      month
 * @returns {PlanInput|null}
 */
export function planFor(sortedPlans, month) {
  let found = null;
  for (const p of sortedPlans) {
    if (p.effectiveFrom <= month) found = p;
    else break;
  }
  return found;
}

/**
 * Esegue la ripartizione mese per mese e restituisce lo stato attuale di ogni obiettivo.
 *
 * Regole concordate:
 * - mese negativo: gli obiettivi scendono in proporzione alla loro quota;
 * - obiettivo raggiunto (accantonato ≥ importo): smette di ricevere quote, anche negative, e la
 *   sua percentuale finisce nel libero;
 * - obiettivo concluso o annullato: dal mese di chiusura il suo disponibile passa al libero
 *   (o all'obiettivo indicato in `transferTo`), comprese le spese collegate successive.
 *
 * @param {ComputeInput} input
 * @returns {{ goals: Object<string, object>, free: number, firstMonth: string|null }}
 */
export function allocate({ goals, plans, savingsByMonth, linkedExpenses, currentMonth }) {
  const sortedPlans = [...plans].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  const state = {};
  for (const g of goals) {
    state[g.id] = {
      goal: g,
      allocated: 0,     // quote mensili ricevute
      transferredIn: 0, // da obiettivi annullati
      spent: 0,         // spese collegate
      returned: 0,      // passato al libero/altro obiettivo alla chiusura
      started: false,
      closed: false,
      reachedMonth: null,
      monthly: [],      // { month, quota, savings, pct }
      series: [],       // { month, saved, available }
    };
  }

  // "Accantonato": tutto ciò che è entrato nell'obiettivo. Il raggiungimento si misura su questo,
  // non sul disponibile: pagare l'acconto del viaggio non deve far "tornare indietro" l'obiettivo.
  const saved = (s) => s.goal.initialAmount + s.allocated + s.transferredIn;
  const available = (s) => saved(s) - s.spent - s.returned;

  const expensesByMonth = {};
  for (const e of linkedExpenses) {
    (expensesByMonth[e.month] ??= []).push(e);
  }

  const starts = [
    ...sortedPlans.map((p) => p.effectiveFrom),
    ...goals.map((g) => g.createdMonth),
    ...linkedExpenses.map((e) => e.month),
  ];
  if (starts.length === 0) return { goals: state, free: 0, firstMonth: null };
  const firstMonth = starts.reduce((a, b) => (a < b ? a : b));

  let free = 0;

  for (let month = firstMonth; month <= currentMonth; month = addMonths(month, 1)) {
    // 1. Gli obiettivi nati questo mese entrano con il loro accantonato iniziale.
    for (const s of Object.values(state)) {
      if (!s.started && s.goal.createdMonth <= month) s.started = true;
    }

    // 2. Chiusure: avvengono a inizio mese, quindi il mese di chiusura non riceve quote.
    for (const s of Object.values(state)) {
      const g = s.goal;
      if (s.closed || g.status === 'active' || !g.closedMonth || g.closedMonth > month) continue;
      s.closed = true;
      const rest = available(s);
      s.returned += rest;
      const target = g.status === 'cancelled' && g.transferTo ? state[g.transferTo] : null;
      if (target && target.goal.status === 'active') target.transferredIn += rest;
      else free += rest;
    }

    // 3. Ripartizione, solo per i mesi chiusi.
    if (month < currentMonth) {
      const savings = savingsByMonth[month] ?? 0;
      const plan = planFor(sortedPlans, month);
      let assigned = 0;

      for (const share of plan?.shares ?? []) {
        const s = state[share.goalId];
        if (!s || !s.started || s.closed || s.reachedMonth) continue;

        let quota = (savings * share.pct) / 100;
        const missing = s.goal.targetAmount - saved(s);
        if (quota > missing) quota = missing; // l'eccedenza resta nel libero

        s.allocated += quota;
        assigned += quota;
        s.monthly.push({ month, savings: round2(savings), pct: share.pct, quota: round2(quota) });
        if (saved(s) >= s.goal.targetAmount - EPSILON) s.reachedMonth = month;
      }
      free += savings - assigned;
    }

    // 4. Spese collegate del mese: a carico dell'obiettivo, o del libero se è già chiuso.
    for (const e of expensesByMonth[month] ?? []) {
      const s = state[e.goalId];
      if (s && !s.closed) s.spent += e.amount;
      else free -= e.amount;
    }

    for (const s of Object.values(state)) {
      if (s.started) s.series.push({ month, saved: round2(saved(s)), available: round2(available(s)) });
    }
  }

  for (const s of Object.values(state)) {
    s.saved = saved(s);
    s.available = available(s);
  }
  return { goals: state, free, firstMonth };
}

// ── Media e proiezione ────────────────────────────────────────────────────────

/**
 * Media del risparmio netto sugli ultimi `window` mesi chiusi che hanno dati.
 *
 * @param {Object<string, number>} savingsByMonth
 * @param {string}      currentMonth
 * @param {string|null} firstDataMonth
 * @param {number}      window
 * @returns {{ avg: number|null, months: number }}
 */
export function averageSavings(savingsByMonth, currentMonth, firstDataMonth, window = 6) {
  if (!firstDataMonth) return { avg: null, months: 0 };
  const lastClosed = addMonths(currentMonth, -1);
  const from = [addMonths(currentMonth, -window), firstDataMonth].reduce((a, b) => (a > b ? a : b));
  const n = monthDiff(from, lastClosed) + 1;
  if (n <= 0) return { avg: null, months: 0 };
  let sum = 0;
  for (let m = from; m <= lastClosed; m = addMonths(m, 1)) sum += savingsByMonth[m] ?? 0;
  return { avg: sum / n, months: n };
}

/**
 * Proiezione lineare di un obiettivo attivo fino alla scadenza.
 *
 * I mesi ancora da ripartire vanno dal mese in corso (che verrà ripartito alla chiusura) alla
 * scadenza inclusa. La quota attesa è media × percentuale del piano attuale.
 *
 * @param {object} p
 * @param {number}      p.saved
 * @param {number}      p.target
 * @param {string}      p.deadline
 * @param {string}      p.currentMonth
 * @param {number|null} p.avgSavings
 * @param {number}      p.pct
 */
export function projectGoal({ saved, target, deadline, currentMonth, avgSavings, pct }) {
  const monthsLeft = Math.max(0, monthDiff(currentMonth, deadline) + 1);
  const remaining = Math.max(0, target - saved);
  const expectedQuota = avgSavings == null ? null : (avgSavings * pct) / 100;

  const series = [];
  let projectedAtDeadline = saved;
  if (expectedQuota != null) {
    let v = saved;
    for (let i = 0; i < monthsLeft; i++) {
      v = Math.min(target, v + expectedQuota);
      // Il valore proiettato a fine mese i: si allinea alla serie storica, che è per fine mese.
      series.push({ month: addMonths(currentMonth, i), projected: round2(v) });
    }
    projectedAtDeadline = v;
  }

  let reachMonth = null;
  if (remaining <= EPSILON) reachMonth = currentMonth;
  else if (expectedQuota > 0) reachMonth = addMonths(currentMonth, Math.ceil(remaining / expectedQuota) - 1);

  return {
    monthsLeft,
    remaining: round2(remaining),
    requiredMonthly: monthsLeft > 0 ? round2(remaining / monthsLeft) : null,
    expectedQuota: expectedQuota == null ? null : round2(expectedQuota),
    projectedAtDeadline: round2(projectedAtDeadline),
    reachMonth,
    series,
  };
}

/**
 * Ripartizione suggerita: a ciascun obiettivo la percentuale che serve per arrivare in tempo.
 *
 * Con un solo obiettivo attivo propone il 100%. Se la somma necessaria supera il risparmio medio
 * le percentuali vengono scalate a 100 e `feasible` diventa false: il piano non basta comunque e
 * l'interfaccia deve dirlo, invece di nasconderlo dietro numeri che sommano a 100.
 *
 * @param {{goalId: string, requiredMonthly: number|null}[]} needs - Obiettivi attivi non raggiunti.
 * @param {number|null} avgSavings
 * @returns {{ shares: {goalId: string, pct: number}[], feasible: boolean|null }}
 */
export function suggestShares(needs, avgSavings) {
  if (needs.length === 0) return { shares: [], feasible: null };
  if (needs.length === 1) {
    const feasible = avgSavings > 0 ? (needs[0].requiredMonthly ?? 0) <= avgSavings + EPSILON : null;
    return { shares: [{ goalId: needs[0].goalId, pct: 100 }], feasible };
  }
  if (!(avgSavings > 0)) {
    // Senza un risparmio medio positivo non c'è un bisogno da misurare: parti uguali.
    const base = Math.floor(100 / needs.length);
    return { shares: needs.map((n) => ({ goalId: n.goalId, pct: base })), feasible: null };
  }

  const raw = needs.map((n) => ({ goalId: n.goalId, pct: ((n.requiredMonthly ?? 0) / avgSavings) * 100 }));
  const total = raw.reduce((s, r) => s + r.pct, 0);
  const feasible = total <= 100 + EPSILON;
  const scale = feasible ? 1 : 100 / total;

  // Arrotondo per eccesso quando c'è margine (meglio un euro in più che arrivare corti),
  // per difetto quando si scala, così la somma non supera mai 100.
  const shares = raw.map((r) => ({
    goalId: r.goalId,
    pct: feasible ? Math.min(100, Math.ceil(r.pct)) : Math.floor(r.pct * scale),
  }));
  if (feasible && shares.reduce((s, r) => s + r.pct, 0) > 100) {
    // Gli arrotondamenti per eccesso possono sforare di qualche punto: torno al difetto.
    for (const s of shares) s.pct = Math.floor(raw.find((r) => r.goalId === s.goalId).pct);
  }
  return { shares, feasible };
}

// ── Composizione finale ───────────────────────────────────────────────────────

/**
 * Calcola tutto ciò che serve alla sezione Obiettivi.
 *
 * @param {ComputeInput} input
 */
export function computeGoals(input) {
  const { goals, plans, savingsByMonth, currentMonth, firstDataMonth, currentMonthSavings = 0, avgWindow = 6 } = input;

  const { goals: state, free } = allocate(input);
  const { avg, months: avgMonths } = averageSavings(savingsByMonth, currentMonth, firstDataMonth, avgWindow);

  const sortedPlans = [...plans].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const currentPlan = planFor(sortedPlans, currentMonth);
  const pctOf = (goalId) => currentPlan?.shares.find((s) => s.goalId === goalId)?.pct ?? null;

  const result = goals.map((g) => {
    const s = state[g.id];
    const reached = !!s.reachedMonth || s.saved >= g.targetAmount - EPSILON;
    const pct = pctOf(g.id);

    const base = {
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      deadline: g.deadline,
      initialAmount: g.initialAmount,
      createdMonth: g.createdMonth,
      status: g.status,
      closedMonth: g.closedMonth,
      transferTo: g.transferTo,
      saved: round2(s.saved),
      spent: round2(s.spent),
      available: round2(s.available),
      returned: round2(s.returned),
      progress: g.targetAmount > 0 ? Math.max(0, Math.min(1, s.saved / g.targetAmount)) : 0,
      reachedMonth: s.reachedMonth,
      pct,
      monthly: s.monthly,
      series: s.series,
    };

    if (g.status !== 'active') return { ...base, state: g.status, projection: null };

    const projection = projectGoal({
      saved: s.saved, target: g.targetAmount, deadline: g.deadline, currentMonth, avgSavings: avg, pct: pct ?? 0,
    });

    let goalState;
    if (reached) goalState = 'reached';
    else if (g.deadline < currentMonth) goalState = 'expired';
    else if (avg == null || pct == null) goalState = 'unknown';
    else goalState = projection.projectedAtDeadline >= g.targetAmount - EPSILON ? 'on_track' : 'behind';

    return { ...base, state: goalState, projection };
  });

  const open = result.filter((r) => r.status === 'active' && r.state !== 'reached');
  const needs = open.map((r) => ({ goalId: r.id, requiredMonthly: r.projection.requiredMonthly }));
  const totalRequired = needs.reduce((sum, n) => sum + (n.requiredMonthly ?? 0), 0);
  const missingFromPlan = open.filter((r) => r.pct == null).map((r) => r.id);

  return {
    currentMonth,
    avgSavings: avg == null ? null : round2(avg),
    avgMonths,
    currentMonthSavings: round2(currentMonthSavings),
    free: round2(free),
    totalRequired: round2(totalRequired),
    feasible: avg == null ? null : totalRequired <= avg + EPSILON,
    plan: currentPlan
      ? { effectiveFrom: currentPlan.effectiveFrom, shares: currentPlan.shares }
      : null,
    // Obiettivi attivi senza quota nel piano: la UI blocca finché non si sceglie una ripartizione.
    planNeedsUpdate: missingFromPlan.length > 0,
    missingFromPlan,
    suggestion: suggestShares(needs, avg),
    goals: result,
  };
}
