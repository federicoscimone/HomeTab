/**
 * @fileoverview Un movimento da una riga di testo o dalla foto di uno scontrino: la bozza, con la
 * categoria. Lo usano la pagina «Nuovo movimento» (che riempie il modulo) e il bot Telegram.
 * @module lib/services/quickEntry
 *
 * - Testo («12,50 pizza»): letto senza IA (lib/utils/quickEntry.js).
 * - Scontrino: letto dal modello dell'import (lib/ai/tasks/receipt.js); la foto non si salva.
 * - Categoria: la catena dell'import, parole chiave e storico in locale, poi l'IA se è attiva,
 *   che riceve solo il testo del movimento, mascherato come nell'import.
 *
 * La bozza non si salva da sola: la conferma l'utente, nel modulo o con il pulsante del bot.
 */

import { aiAvailability, runStructured } from '../ai/index.js';
import { loadAiSettings } from '../ai/settings.js';
import { suggestCategories } from '../ai/tasks/categorize.js';
import { readReceipt, SCHEMA as RECEIPT_SCHEMA, SYSTEM as RECEIPT_SYSTEM } from '../ai/tasks/receipt.js';
import { localSuggester } from './localCategorize.js';
import { DEFAULT_METHOD, parseQuickEntry } from '../utils/quickEntry.js';
import { getPaymentGroup } from '../utils/payments.js';
import { dayOf } from '../utils/goalMath.js';
import logger from '../logger.js';

export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Se la lettura degli scontrini è disponibile adesso (IA configurata, tetto non raggiunto…). */
export async function receiptAvailability() {
  const { available, reason } = aiAvailability('receiptScan', await loadAiSettings());
  return { available, reason };
}

/**
 * La categoria per un movimento nuovo, con la catena dell'import.
 *
 * @returns {Promise<{ categoryId: string|null, subCategory1Id: string|null, categoryFromAi: boolean }>}
 */
export async function categorizeDraft({ description, payee = '', type, amount }, userId) {
  const suggest = await localSuggester();
  const row = { description, payee: payee || description, place: '', type };
  let hit = suggest(row);
  if (!hit && aiAvailability('importCategorize', await loadAiSettings()).available) {
    try {
      const { suggestions } = await suggestCategories([{ id: 1, ...row, amount }], { userId });
      const s = suggestions.find((x) => x.categoryId && !x.uncertain);
      if (s) hit = { source: 'ai', categoryId: s.categoryId, subCategory1Id: s.subCategory1Id };
    } catch (err) {
      logger.warn('Categoria IA per un movimento rapido non riuscita', { error: err?.message });
    }
  }
  return {
    categoryId: hit?.categoryId ? String(hit.categoryId) : null,
    subCategory1Id: hit?.subCategory1Id ? String(hit.subCategory1Id) : null,
    categoryFromAi: hit?.source === 'ai',
  };
}

/** La bozza completa, pronta per il modulo o per Movement.create (dopo aver tolto categoryFromAi). */
async function toDraft({ amount, type, date, paymentMethod, description, payee = '' }, userId) {
  const category = await categorizeDraft({ description, payee, type, amount }, userId);
  return {
    amount, type, date, paymentMethod,
    paymentGroup: getPaymentGroup(paymentMethod),
    description: description.slice(0, 500),
    payee: (payee || '').slice(0, 200),
    ...category,
  };
}

/**
 * @param {string} text - «12,50 pizza», «ieri 40 benzina contanti», «+1500 stipendio».
 * @returns {Promise<object|null>} null se nel testo non c'è un importo.
 */
export async function draftFromText(text, userId) {
  const parsed = parseQuickEntry(text, dayOf(new Date()));
  return parsed ? toDraft(parsed, userId) : null;
}

/**
 * @param {{ data: string, mediaType: string }} image - Base64, uno dei RECEIPT_TYPES.
 * @returns {Promise<object|null>} null se non è uno scontrino o il totale non si legge.
 * @throws {import('../ai/index.js').AiError} IA spenta, tetto raggiunto, errore del servizio.
 */
export async function draftFromReceipt(image, userId) {
  const res = await runStructured({
    task: 'receiptScan', system: RECEIPT_SYSTEM, prompt: 'Read this receipt.', schema: RECEIPT_SCHEMA,
    maxTokens: 2_000, userId, images: [image],
  });
  const receipt = readReceipt(res.data, dayOf(new Date()));
  if (!receipt) return null;
  return toDraft({
    amount: receipt.amount, type: 'expense', date: receipt.date,
    paymentMethod: receipt.paymentMethod ?? DEFAULT_METHOD,
    description: receipt.merchant, payee: receipt.merchant,
  }, userId);
}
