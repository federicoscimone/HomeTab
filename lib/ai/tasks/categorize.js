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
import { maskRow } from '../mask.js';
import { runStructured } from '../index.js';

/** Sotto questa confidenza il suggerimento si scarta: meglio una riga vuota che una sbagliata. */
export const MIN_CONFIDENCE = 0.6;
/** Righe distinte per chiamata: abbastanza per ammortizzare istruzioni e categorie. */
export const BATCH_SIZE = 40;
/** Esercenti già categorizzati inviati come esempi. */
export const EXAMPLES = 40;

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
[NOME]: ignore them and never copy them into merchant or place. The examples show how this family
categorized similar merchants before: follow them when they apply.`;

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
 * @returns {{ items: { id: number, type: string, amount: number, text: string }[], members: Map<number, number[]> }}
 *   `items[].id` è l'indice del gruppo; `members` porta dal gruppo agli id delle righe.
 */
export function dedupeRows(rows) {
  const items = [];
  const members = new Map();
  const index = new Map();
  for (const row of rows) {
    const text = rowText(row);
    if (!text) continue;
    const type = row.type === 'income' ? 'income' : 'expense';
    const key = `${type}\u0000${text.toUpperCase()}`;
    if (!index.has(key)) {
      const id = items.length;
      index.set(key, id);
      // L'importo aiuta (un caffè non è una spesa al supermercato) ma basta quello del primo.
      items.push({ id, type, amount: Math.round((Number(row.amount) || 0) * 100) / 100, text });
      members.set(id, []);
    }
    members.get(index.get(key)).push(row.id);
  }
  return { items, members };
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
 *   confidence: number, merchant: string|null, place: string|null }[]}
 */
export function readSuggestions(data, groups, byCode) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(data?.rows) ? data.rows : []) {
    if (!Number.isInteger(r?.id) || !groups.members.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    const confidence = Math.min(1, Math.max(0, Number(r.confidence) || 0));
    const target = typeof r.category === 'string' && confidence >= MIN_CONFIDENCE ? byCode.get(r.category.trim()) : null;
    const merchant = cleanName(r.merchant);
    const place = cleanName(r.place);
    if (!target && !merchant && !place) continue;
    for (const id of groups.members.get(r.id)) {
      out.push({
        id,
        categoryId: target?.categoryId ?? null,
        subCategory1Id: target?.subCategory1Id ?? null,
        confidence,
        merchant,
        place,
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
  const batches = [];
  for (let start = 0; start < groups.items.length; start += BATCH_SIZE) {
    const items = groups.items.slice(start, start + BATCH_SIZE);
    batches.push({ items, prompt: buildPrompt(codes.list, examples, items), maxTokens: 1_000 + items.length * 80 });
  }
  return { system: SYSTEM, schema: SCHEMA, codes, groups, examples, batches };
}

/**
 * Suggerisce categoria, esercente e luogo per le righe date.
 *
 * @param {{ id: number, description?: string, payee?: string, place?: string, type?: string, amount?: number }[]} rows
 * @param {{ userId?: string }} [opts]
 * @returns {Promise<{ suggestions: ReturnType<typeof readSuggestions>, costMicro: number,
 *   model: string|null, failedBatches: number, error: string|null }>}
 *   `error`: il codice di AiError del primo lotto fallito ('budget', 'failed'…), se uno è fallito.
 */
export async function suggestCategories(rows, { userId = null } = {}) {
  const { system, schema, codes, groups, batches } = await buildRequests(rows);
  const suggestions = [];
  let costMicro = 0;
  let model = null;
  let failedBatches = 0;
  let error = null;
  if (codes.list.length === 0) return { suggestions, costMicro, model, failedBatches, error };

  // In sequenza: a tetto quasi pieno un lotto alla volta si ferma al primo che non ci sta,
  // invece di prenotare tutti insieme e farli fallire tutti.
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    try {
      // Circa 50 token di JSON per riga, più spazio per il ragionamento: è un limite, non un costo.
      const res = await runStructured({
        task: 'importCategorize', system, prompt: batch.prompt, schema, maxTokens: batch.maxTokens, userId,
      });
      costMicro += res.costMicro;
      model = res.model;
      suggestions.push(...readSuggestions(res.data, groups, codes.byCode));
    } catch (err) {
      failedBatches += 1;
      error ??= err?.code || 'failed';
      // Tetto raggiunto o IA spenta: i lotti successivi fallirebbero allo stesso modo.
      if (err?.code === 'budget' || err?.code === 'unavailable') {
        failedBatches += batches.length - i - 1;
        break;
      }
    }
  }
  return { suggestions, costMicro, model, failedBatches, error };
}
