/**
 * Misura la chat sui dati: fa dieci domande a un'istanza in esecuzione e controlla che ogni
 * risposta contenga i numeri giusti. I valori attesi non li calcola lo script: li legge dalle API
 * delle pagine (dashboard, report, movimenti, obiettivi), cioè dai numeri che l'utente vedrebbe
 * aprendo il link della risposta. Una risposta è corretta se contiene tutti gli importi attesi,
 * formattati come nell'app; la domanda fuori tema è corretta se non usa strumenti e non cita
 * importi.
 *
 * Pensato per i dati della demo, ma le domande sono relative alla data di oggi: funziona con
 * qualunque database che abbia movimenti nell'anno in corso e in quello precedente.
 * Ogni passata costa qualche decina di centesimi con Sonnet 5.5 e conta sul tetto mensile.
 *
 * Uso:
 *   node scripts/chat-eval.js [--url http://127.0.0.1:3100] [--only 3,7] [--verbose]
 *
 * Credenziali da EVAL_EMAIL ed EVAL_PASSWORD; senza, l'account demo.
 */

import { fmtFull } from '../lib/utils/format.js';
import { todayString } from '../lib/utils/comparePeriods.js';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const BASE = (opt('--url') ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
const ONLY = opt('--only')?.split(',').map(Number) ?? null;
const VERBOSE = args.includes('--verbose');
const EMAIL = process.env.EVAL_EMAIL ?? 'mario@test.it';
const PASSWORD = process.env.EVAL_PASSWORD ?? 'Asdf_lkjH';

// --- Sessione: lo stesso login del form, con i cookie tenuti a mano. ---

const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
function keepCookies(res) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

async function login() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  keepCookies(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, json: 'true' }),
  });
  keepCookies(res);
  if (![...jar.keys()].some((k) => k.includes('session-token'))) throw new Error('login non riuscito');
}

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader() } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function ask(question) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': 'it', Cookie: cookieHeader() },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`/api/chat: HTTP ${res.status} ${await res.text()}`);
  let text = '';
  const tools = [];
  let done = null;
  for (const line of (await res.text()).split('\n').filter(Boolean)) {
    const e = JSON.parse(line);
    if (e.type === 'text') text += e.delta;
    else if (e.type === 'reset') text = '';
    else if (e.type === 'tool') tools.push(e.name);
    else if (e.type === 'done') done = e;
    else if (e.type === 'error') throw new Error(`errore della chat: ${e.code}`);
  }
  return { text, tools, costUsd: done?.costUsd ?? 0 };
}

// --- Le domande, con i valori attesi presi dalle pagine. ---

const today = todayString();
const year = Number(today.slice(0, 4));
const month = Number(today.slice(5, 7));
const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
const sameDayLastYear = `${year - 1}${today.slice(4)}`;
const money = (v) => fmtFull(v, 'it');
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

async function categoryId(name, level = 1) {
  const cats = await api('/api/categorie');
  const c = cats.find((x) => x.name === name && x.level === level);
  if (!c) throw new Error(`categoria «${name}» assente`);
  return c._id;
}

/** Totale delle uscite dalla lista dei movimenti, con i filtri del link che la chat propone. */
async function listSum(params) {
  return (await api(`/api/movimenti?${new URLSearchParams({ ...params, limit: '1' })}`)).sums.expense;
}

const CASES = [
  {
    q: 'Quanto abbiamo speso e quanto abbiamo incassato il mese scorso?',
    expect: async () => {
      const d = await api(`/api/dashboard?year=${prev.year}&month=${prev.month}`);
      return [money(d.current.totalExpense), money(d.current.totalIncome)];
    },
  },
  {
    q: 'Quanto abbiamo risparmiato il mese scorso?',
    expect: async () => {
      const d = await api(`/api/dashboard?year=${prev.year}&month=${prev.month}`);
      return [money(d.current.totalIncome - d.current.totalExpense)];
    },
  },
  {
    q: 'Qual è stata la categoria di spesa più alta il mese scorso, e quanto?',
    expect: async () => {
      const top = (await api(`/api/dashboard?year=${prev.year}&month=${prev.month}`)).byCategory[0];
      return [top.name, money(top.amount)];
    },
  },
  {
    q: `Quanto è costata la spesa alimentare a ${MONTHS[prev.month - 1]}?`,
    expect: async () => {
      const r = await api(`/api/report/categorie?year=${prev.year}&month=${prev.month}&type=expense&paymentGroup=traditional`);
      return [money(r.categories.find((c) => c.categoryName === 'Spesa').totalCur)];
    },
  },
  {
    q: 'Quanto abbiamo speso di carburante quest\'anno?',
    expect: async () => {
      const r = await api(`/api/report/categorie?year=${year}&type=expense&paymentGroup=traditional`);
      return [money(r.categories.find((c) => c.categoryName === 'Carburante').totalCur)];
    },
  },
  {
    q: 'Quanto abbiamo speso in ristoranti quest\'anno rispetto all\'anno scorso?',
    expect: async () => {
      const sub = await categoryId('Ristorante', 2);
      const base = { categoryIds: sub, type: 'expense', paymentGroup: 'traditional', inAnalysis: '1' };
      return [
        money(await listSum({ ...base, from: `${year}-01-01`, to: today })),
        money(await listSum({ ...base, from: `${year - 1}-01-01`, to: sameDayLastYear })),
      ];
    },
  },
  {
    q: 'Confronta le spese del primo trimestre di quest\'anno con quelle del primo trimestre dell\'anno scorso.',
    expect: async () => {
      const r = await api(`/api/report/analisi?from=${year}-01-01&to=${year}-03-31&type=expense&paymentGroup=traditional`);
      return [money(r.totalCur), money(r.totalPrev)];
    },
  },
  {
    q: 'Quanto abbiamo speso da Esselunga quest\'anno?',
    expect: async () => [money(await listSum({ search: 'Esselunga', from: `${year}-01-01`, to: today, type: 'expense' }))],
  },
  {
    q: 'Quanto ci manca per l\'obiettivo dell\'auto nuova, e quanto dovremmo mettere da parte al mese?',
    expect: async () => {
      const g = (await api('/api/obiettivi')).goals.find((x) => x.name === 'Auto nuova');
      return [money(g.projection.remaining), money(g.projection.requiredMonthly)];
    },
  },
  {
    q: 'Che tempo farà domani a Milano?',
    offTopic: true,
  },
];

// --- Esecuzione. ---

/** Spazi normali al posto di quelli unificatori: il modello a volte li cambia, il numero no. */
const plain = (s) => s.replace(/[  ]/g, ' ');

await login();
let passed = 0;
let total = 0;
let cost = 0;
for (const [i, c] of CASES.entries()) {
  const n = i + 1;
  if (ONLY && !ONLY.includes(n)) continue;
  total += 1;
  const expected = c.offTopic ? [] : await c.expect();
  const r = await ask(c.q);
  cost += r.costUsd;
  const answer = plain(r.text);
  const missing = expected.filter((e) => !answer.includes(plain(e)));
  const ok = c.offTopic ? r.tools.length === 0 && !/\d\s?€/.test(answer) : missing.length === 0;
  if (ok) passed += 1;
  console.log(`${ok ? 'OK ' : 'NO '} ${n}. ${c.q}`);
  console.log(`     strumenti: ${r.tools.join(', ') || 'nessuno'} · $${r.costUsd.toFixed(4)}`);
  if (!ok && missing.length) console.log(`     mancano: ${missing.join(' | ')}`);
  if (!ok || VERBOSE) console.log(`     risposta: ${answer.replace(/\n+/g, ' ⏎ ')}`);
}
console.log(`\n${passed}/${total} corrette (${Math.round((passed / total) * 100)}%) · costo $${cost.toFixed(4)}`);
process.exitCode = passed === total ? 0 : 1;
