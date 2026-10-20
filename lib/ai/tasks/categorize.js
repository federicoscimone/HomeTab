/**
 * @fileoverview Categorie suggerite dall'IA per le righe che le parole chiave non riconoscono.
 * @module lib/ai/tasks/categorize
 *
 * Come funziona una richiesta:
 * - le categorie vanno al modello con codici brevi (`c3`, `c3.1`) invece degli id di Mongo: costano
 *   meno token, e un codice inventato non corrisponde a nulla e viene scartato;
 * - le righe con lo stesso testo partono una volta sola: dieci «ESSELUNGA» sono una riga;
 * - come esempi vanno alcuni esercenti già categorizzati dall'utente, perché il modello impari le
 *   abitudini della famiglia invece di indovinarle;
 * - tutto il testo è mascherato (lib/ai/mask.js) prima di partire;
 * - sotto la soglia di confidenza la riga resta senza categoria.
 *
 * Le funzioni pure (codici, deduplica, lettura della risposta) sono separate da quella che legge
 * il database, così si possono provare senza Mongo.
 */

import Category from '../../models/Category.js';
import Movement from '../../models/Movement.js';
import { maskRow, maskText } from '../mask.js';
import { lookupMerchant } from '../../utils/merchantHistory.js';
import { loadHistoryIndex } from '../../services/merchantHistory.js';
import { aiAvailability, runStructured } from '../index.js';
import { loadAiSettings } from '../settings.js';

/** Da questa confidenza in su il suggerimento è affidabile e si applica come gli altri. */
export const MIN_CONFIDENCE = 0.6;
/**
 * Fra questa soglia e MIN_CONFIDENCE il suggerimento è «incerto»: si mostra, ma non si applica
 * da solo. Sotto, si scarta: un'ipotesi così debole confonde più di quanto aiuti.
 */
export const UNCERTAIN_CONFIDENCE = 0.3;
/** Righe distinte per chiamata: abbastanza per ammortizzare istruzioni e categorie. */
export const BATCH_SIZE = 40;
/** Esercenti già categorizzati inviati come esempi generali; quelli mirati vanno con ogni riga. */
export const EXAMPLES = 20;

const SYSTEM = `You categorize bank transactions for a family budgeting app.

For each transaction:
- category: the code of the single best category from the list, preferring a subcategory code
  (like "c3.1") when one clearly fits, otherwise the parent code ("c3"). Use null when no category
  fits or you are unsure. Never invent codes.
- confidence: your probability, from 0 to 1, that the category is right.
- merchant: the merchant or counterparty in a clean, human form (e.g. "IKEA", "Esselunga",
  "Enel Energia"), or null if the text has none.
- place: the town or city if clearly present (e.g. "Catania"), otherwise null.

Personal data was replaced by placeholders such as [NUM], [CARTA], [IBAN], [CF], [EMAIL] and
[NOME]: ignore them and never copy them into merchant or place.

Two kinds of examples show how this family categorized merchants before:
- "similar", inside a transaction: past transactions of this family whose merchant looks like
  this one, with their category. Many merchants have names that say nothing about what they
  sell: when a similar past transaction clearly refers to the same merchant, use its category,
  even if you can't tell from the name alone.
- "examples", at the top: recent merchants of the family, for its general habits.

A transaction may also carry "bankCategory": the category the bank itself assigned. It uses the
bank's own scheme, not the family's, but it says what kind of merchant this is: use it as a strong
hint when the name alone is not enough.`;

const SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          category: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          confidence: { type: 'number' },
          merchant: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          place: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
        required: ['id', 'category', 'confidence', 'merchant', 'place'],
        additionalProperties: false,
      },
    },
  },
  required: ['rows'],
  additionalProperties: false,
};

/**
 * Codici brevi per le categorie di livello 1 e 2 (il livello 3 nell'import non si usa).
 * @param {{ _id: any, name: string, level: number, parentId?: any }[]} categories
 * @returns {{ list: { code: string, name: string, parent: string|null }[],
 *   byCode: Map<string, { categoryId: string, subCategory1Id: string|null }>,
 *   codeOf: (categoryId: any, subCategory1Id: any) => string|null }}
 */
export function categoryCodes(categories) {
  const list = [];
  const byCode = new Map();
  const codeById = new Map();
  const roots = categories.filter((c) => c.level === 1);
  roots.forEach((root, i) => {
    const code = `c${i + 1}`;
    list.push({ code, name: root.name, parent: null });
    byCode.set(code, { categoryId: String(root._id), subCategory1Id: null });
    codeById.set(String(root._id), code);
    categories
      .filter((c) => c.level === 2 && String(c.parentId) === String(root._id))
      .forEach((sub, j) => {
        const subCode = `${code}.${j + 1}`;
        list.push({ code: subCode, name: sub.name, parent: code });
        byCode.set(subCode, { categoryId: String(root._id), subCategory1Id: String(sub._id) });
        codeById.set(`${root._id}/${sub._id}`, subCode);
      });
  });
  const codeOf = (categoryId, subCategory1Id) =>
    (subCategory1Id && codeById.get(`${categoryId}/${subCategory1Id}`)) || codeById.get(String(categoryId)) || null;
  return { list, byCode, codeOf };
}

/** @returns {string} Il testo di una riga come lo vede il modello: campi non vuoti, mascherati. */
export const rowText = (row) => {
  const m = maskRow(row);
  return [m.description, m.payee, m.place].filter(Boolean).join(' | ');
};

/**
 * Raggruppa le righe con lo stesso testo e lo stesso tipo: si chiede una volta, vale per tutte.
 * @param {{ id: number, description?: string, payee?: string, place?: string, type?: string, amount?: number }[]} rows
 * @returns {{ items: { id: number, type: string, amount: number, text: string }[], members: Map<number, number[]>,
 *   rawText: Map<number, string> }}
 *   `items[].id` è l'indice del gruppo; `members` porta dal gruppo agli id delle righe; `rawText` è
 *   il testo originale del gruppo, per la ricerca nello storico (non viene inviato).
 */
export function dedupeRows(rows) {
  const items = [];
  const members = new Map();
  const index = new Map();
  // Il testo originale serve solo a cercare nello storico, in locale: non entra negli item inviati.
  const rawText = new Map();
  for (const row of rows) {
    const text = rowText(row);
    if (!text) continue;
    const type = row.type === 'income' ? 'income' : 'expense';
    // La categoria della banca è un'etichetta generica («Alimentari»), non un dato personale: si
    // maschera comunque, per prudenza, e distingue righe con lo stesso testo.
    const bankCategory = maskText(row.bankCategory).slice(0, 60);
    const key = `${type}\u0000${text.toUpperCase()}\u0000${bankCategory.toUpperCase()}`;
    if (!index.has(key)) {
      const id = items.length;
      index.set(key, id);
      // L'importo aiuta (un caffè non è una spesa al supermercato) ma basta quello del primo.
      items.push({
        id, type, amount: Math.round((Number(row.amount) || 0) * 100) / 100, text,
        ...(bankCategory ? { bankCategory } : {}),
      });
      members.set(id, []);
      rawText.set(id, [row.description, row.payee, row.place].filter(Boolean).join(' '));
    }
    members.get(index.get(key)).push(row.id);
  }
  return { items, members, rawText };
}

/** Un nome pulito, senza segnaposto né testo eccessivo; altrimenti null. */
function cleanName(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > 80 || /\[[A-Z]+\]/.test(v)) return null;
  return v;
}

/**
 * Dalla risposta del modello ai suggerimenti per riga, scartando ciò che non torna.
 *
 * @param {{ rows?: object[] }} data - JSON della risposta.
 * @param {ReturnType<typeof dedupeRows>} groups
 * @param {ReturnType<typeof categoryCodes>['byCode']} byCode
 * @returns {{ id: number, categoryId: string|null, subCategory1Id: string|null,
 *   confidence: number, uncertain: boolean, merchant: string|null, place: string|null, kind?: string }[]}
 *   `uncertain`: categoria con confidenza fra UNCERTAIN_CONFIDENCE e MIN_CONFIDENCE, da proporre
 *   senza applicarla.
 */
export function readSuggestions(data, groups, byCode) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(data?.rows) ? data.rows : []) {
    if (!Number.isInteger(r?.id) || !groups.members.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    const confidence = Math.min(1, Math.max(0, Number(r.confidence) || 0));
    const target = typeof r.category === 'string' && confidence >= UNCERTAIN_CONFIDENCE ? byCode.get(r.category.trim()) : null;
    const uncertain = Boolean(target) && confidence < MIN_CONFIDENCE;
    // Dalla ricerca web: che attività è, in parole semplici, per spiegare il suggerimento.
    const kind = typeof r.kind === 'string' && r.kind.trim() && !/\[[A-Z]+\]/.test(r.kind) ? r.kind.trim().slice(0, 120) : null;
    const merchant = cleanName(r.merchant);
    const place = cleanName(r.place);
    if (!target && !merchant && !place) continue;
    for (const id of groups.members.get(r.id)) {
      out.push({
        id,
        categoryId: target?.categoryId ?? null,
        subCategory1Id: target?.subCategory1Id ?? null,
        confidence,
        uncertain,
        merchant,
        place,
        ...(kind ? { kind } : {}),
      });
    }
  }
  return out;
}

/** @returns {string} Il messaggio per il modello: categorie, esempi e righe, in JSON compatto. */
export function buildPrompt(list, examples, items) {
  return JSON.stringify({ categories: list, examples, transactions: items });
}

/**
 * Esercenti già categorizzati, i più recenti e distinti, come esempi per il modello.
 * Restano fuori quelli che il mascheramento riduce a un segnaposto: un bonifico salvato con il
 * nome della persona come esercente non deve partire a ogni import.
 * @param {ReturnType<typeof categoryCodes>['codeOf']} codeOf
 */
export async function loadExamples(codeOf) {
  const recent = await Movement.find({ categoryId: { $ne: null }, payee: { $ne: '' } })
    .sort({ date: -1 })
    .limit(EXAMPLES * 10)
    .select('payee description type categoryId subCategory1Id')
    .lean();
  const seen = new Set();
  const examples = [];
  for (const m of recent) {
    const text = maskRow({ payee: m.payee, description: m.description }).payee;
    const key = text.toUpperCase();
    const category = codeOf(m.categoryId, m.subCategory1Id);
    if (!text || /\[[A-Z]+\]/.test(text) || !category || seen.has(key)) continue;
    seen.add(key);
    examples.push({ text, type: m.type, category });
    if (examples.length >= EXAMPLES) break;
  }
  return examples;
}

/**
 * I movimenti passati più simili a una riga, mascherati come tutto il resto, con il codice della
 * loro categoria. La ricerca avviene sul testo originale, in locale; parte solo il risultato.
 */
export function similarExamples(history, rawText, codeOf, type = null) {
  return lookupMerchant(history, rawText, type).similar
    // Solo il testo mascherato con la riga intera, calcolato quando lo storico è stato caricato.
    .map((s) => ({ text: s.sendText || '', category: codeOf(s.categoryId, s.subCategory1Id) }))
    .filter((s) => s.text && s.category && !/\[[A-Z]+\]/.test(s.text));
}

/** @returns {boolean} true se il suggerimento ha una categoria affidabile. */
export const isConfident = (s) => Boolean(s?.categoryId) && !s.uncertain;

/**
 * Unisce due suggerimenti per la stessa riga: vince la categoria più affidabile, e l'esercente
 * trovato dal primo resta se il secondo non ne ha uno.
 */
export function mergeSuggestion(prev, next) {
  if (!prev) return next;
  const better = !prev.categoryId || (next.categoryId && (isConfident(next) && !isConfident(prev)
    || (isConfident(next) === isConfident(prev) && next.confidence > prev.confidence)));
  const base = better ? next : prev;
  return { ...base, merchant: base.merchant ?? prev.merchant ?? next.merchant, place: base.place ?? prev.place ?? next.place };
}

/** Le righe distinte divise in lotti, ciascuno con il suo messaggio. */
function batchesFor(codes, examples, items) {
  const batches = [];
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const part = items.slice(start, start + BATCH_SIZE);
    batches.push({ items: part, prompt: buildPrompt(codes.list, examples, part), maxTokens: 1_000 + part.length * 80 });
  }
  return batches;
}

/**
 * Prepara le richieste esattamente come partirebbero, senza inviarle: la usano sia la chiamata
 * vera sia l'anteprima «Vedi cosa viene inviato».
 *
 * @param {{ id: number, description?: string, payee?: string, place?: string, type?: string, amount?: number }[]} rows
 */
export async function buildRequests(rows) {
  const categories = await Category.find({ level: { $in: [1, 2] } }).sort({ level: 1, order: 1, name: 1 }).lean();
  const codes = categoryCodes(categories);
  const groups = dedupeRows(rows);
  const examples = codes.list.length && groups.items.length ? await loadExamples(codes.codeOf) : [];
  if (groups.items.length) {
    const history = await loadHistoryIndex();
    for (const item of groups.items) {
      const similar = similarExamples(history, groups.rawText.get(item.id), codes.codeOf, item.type);
      if (similar.length) item.similar = similar;
    }
  }
  return { system: SYSTEM, schema: SCHEMA, codes, groups, examples, batches: batchesFor(codes, examples, groups.items) };
}

/**
 * Suggerisce categoria, esercente e luogo per le righe date.
 *
 * @param {{ id: number, description?: string, payee?: string, place?: string, type?: string, amount?: number }[]} rows
 * @param {{ userId?: string }} [opts]
 * @returns {Promise<{ suggestions: ReturnType<typeof readSuggestions>, costMicro: number,
 *   model: string|null, fallbackModel: string|null, failedBatches: number, error: string|null }>}
 *   `fallbackModel`: il modello del secondo passaggio, se c'è stato.
 *   `error`: il codice di AiError del primo lotto fallito ('budget', 'failed'…), se uno è fallito.
 */
export async function suggestCategories(rows, { userId = null } = {}) {
  const { system, schema, codes, groups, examples, batches } = await buildRequests(rows);
  const byRow = new Map();
  let costMicro = 0;
  let model = null;
  let fallbackModel = null;
  let failedBatches = 0;
  let error = null;
  if (codes.list.length === 0) return { suggestions: [], costMicro, model, fallbackModel, failedBatches, error };

  /** Un passaggio su una serie di lotti; si ferma se il tetto è pieno o l'IA spenta. */
  const pass = async (task, passBatches) => {
    for (let i = 0; i < passBatches.length; i += 1) {
      const batch = passBatches[i];
      try {
        // Circa 50 token di JSON per riga, più spazio per il ragionamento: è un limite, non un costo.
        const res = await runStructured({ task, system, prompt: batch.prompt, schema, maxTokens: batch.maxTokens, userId });
        costMicro += res.costMicro;
        if (task === 'importCategorize') model = res.model; else fallbackModel = res.model;
        for (const s of readSuggestions(res.data, groups, codes.byCode)) {
          byRow.set(s.id, mergeSuggestion(byRow.get(s.id), s));
        }
      } catch (err) {
        failedBatches += 1;
        error ??= err?.code || 'failed';
        // Tetto raggiunto o IA spenta: i lotti successivi fallirebbero allo stesso modo.
        if (err?.code === 'budget' || err?.code === 'unavailable') {
          failedBatches += passBatches.length - i - 1;
          return false;
        }
      }
    }
    return true;
  };

  const completed = await pass('importCategorize', batches);

  // Secondo passaggio: le righe distinte ancora senza categoria, a un modello più capace. Solo se
  // il primo si è chiuso senza toccare il tetto, e se il modello di riserva è diverso dal primo.
  const settings = await loadAiSettings();
  const fallback = aiAvailability('importCategorizeFallback', settings);
  const primary = aiAvailability('importCategorize', settings);
  if (completed && fallback.available && fallback.model !== primary.model) {
    // Anche le incerte: il modello più capace può esserne sicuro.
    const left = groups.items.filter((it) => !groups.members.get(it.id).some((rowId) => isConfident(byRow.get(rowId))));
    if (left.length) await pass('importCategorizeFallback', batchesFor(codes, examples, left));
  }

  return { suggestions: [...byRow.values()], costMicro, model, fallbackModel, failedBatches, error };
}

/** Righe distinte per richiesta con ricerca web: una ricerca per riga, prompt sotto i 100.000 token. */
export const WEB_BATCH = 3;
/** Righe distinte per clic: la ricerca costa circa un centesimo a riga, e si decide riga per riga. */
export const WEB_MAX_ROWS = 15;

const SYSTEM_WEB = `You categorize bank transactions for a family budgeting app. The merchants below
could not be recognised from their names: search the web to find out what kind of business each one
is (one search per merchant at most, using the name and the town if present), then choose the category.

For each transaction:
- kind: what the business is, in a few words (e.g. "artisan ice cream shop"), or null if you
  could not find it.
- category: the code of the best category from the list (subcategory code when one clearly fits),
  or null when none fits or you are unsure. Never invent codes.
- confidence: your probability, from 0 to 1, that the category is right.
- merchant, place: the merchant name and the town in a clean form, or null.

Personal data was replaced by placeholders such as [NUM], [CARTA], [IBAN], [CF], [EMAIL] and
[NOME]: never search for them or copy them. If a transaction is a payment to a person, do not
search: answer with category null.`;

const SCHEMA_WEB = {
  ...SCHEMA,
  properties: {
    rows: {
      type: 'array',
      items: {
        ...SCHEMA.properties.rows.items,
        properties: { ...SCHEMA.properties.rows.items.properties, kind: { anyOf: [{ type: 'string' }, { type: 'null' }] } },
        required: [...SCHEMA.properties.rows.items.required, 'kind'],
      },
    },
  },
};

/**
 * Le richieste con ricerca web esattamente come partirebbero: le stesse righe mascherate della
 * categorizzazione, senza esempi dallo storico (qui il modello cerca fuori, non nelle abitudini).
 */
export async function buildWebRequests(rows) {
  const categories = await Category.find({ level: { $in: [1, 2] } }).sort({ level: 1, order: 1, name: 1 }).lean();
  const codes = categoryCodes(categories);
  const groups = dedupeRows(rows);
  const items = groups.items.slice(0, WEB_MAX_ROWS);
  const batches = [];
  for (let start = 0; start < items.length; start += WEB_BATCH) {
    const part = items.slice(start, start + WEB_BATCH);
    batches.push({
      items: part,
      prompt: JSON.stringify({ categories: codes.list, transactions: part }),
      maxTokens: 2_000 + part.length * 300,
      maxUses: part.length,
    });
  }
  return { system: SYSTEM_WEB, schema: SCHEMA_WEB, codes, groups, examples: [], batches, skipped: groups.items.length - items.length };
}

/**
 * Cerca sul web gli esercenti che le altre fonti non hanno riconosciuto.
 * @returns {Promise<{ suggestions: object[], costMicro: number, searches: number, model: string|null,
 *   failedBatches: number, error: string|null, skipped: number }>}
 */
export async function suggestFromWeb(rows, { userId = null } = {}) {
  const { system, schema, codes, groups, batches, skipped } = await buildWebRequests(rows);
  const byRow = new Map();
  let costMicro = 0;
  let searches = 0;
  let model = null;
  let failedBatches = 0;
  let error = null;
  for (let i = 0; i < batches.length; i += 1) {
    const b = batches[i];
    try {
      const res = await runStructured({
        task: 'importWebSearch', system, prompt: b.prompt, schema, maxTokens: b.maxTokens, userId,
        webSearch: { maxUses: b.maxUses },
      });
      costMicro += res.costMicro;
      searches += res.searches;
      model = res.model;
      for (const s of readSuggestions(res.data, groups, codes.byCode)) byRow.set(s.id, mergeSuggestion(byRow.get(s.id), s));
    } catch (err) {
      failedBatches += 1;
      error ??= err?.code || 'failed';
      if (err?.code === 'budget' || err?.code === 'unavailable') { failedBatches += batches.length - i - 1; break; }
    }
  }
  return { suggestions: [...byRow.values()], costMicro, searches, model, failedBatches, error, skipped };
}
