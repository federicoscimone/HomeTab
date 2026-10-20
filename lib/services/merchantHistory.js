/**
 * @fileoverview Indice dello storico degli esercenti, letto dal database per un import.
 * @module lib/services/merchantHistory
 */

import Movement from '../models/Movement.js';
import { buildHistoryIndex, historyText } from '../utils/merchantHistory.js';
import { maskRow } from '../ai/mask.js';

/** Gruppi distinti al massimo: bastano per anni di movimenti di una famiglia. */
const MAX_GROUPS = 20_000;

/**
 * Raggruppa i movimenti già categorizzati per testo dell'esercente e categoria, con il conteggio.
 * Un solo passaggio sul database per import: il confronto poi avviene in memoria.
 */
export async function loadHistoryIndex() {
  const groups = await Movement.aggregate([
    { $match: { categoryId: { $ne: null } } },
    { $group: {
      _id: { payee: '$payee', description: '$description', type: '$type', categoryId: '$categoryId', subCategory1Id: '$subCategory1Id' },
      count: { $sum: 1 },
      last: { $max: '$date' },
    } },
    { $sort: { last: -1 } },
    { $limit: MAX_GROUPS },
  ]);
  // Lo stesso esercente con descrizioni diverse diventa una sola voce, con i conteggi sommati.
  const merged = new Map();
  for (const g of groups) {
    const text = historyText(g._id).trim();
    if (!text) continue;
    const categoryId = String(g._id.categoryId);
    const subCategory1Id = g._id.subCategory1Id ? String(g._id.subCategory1Id) : null;
    const type = g._id.type === 'income' ? 'income' : 'expense';
    const key = `${text.toUpperCase()}\u0000${type}\u0000${categoryId}\u0000${subCategory1Id}`;
    // Il testo come partirebbe verso un modello, mascherato con la riga intera: un bonifico salvato
    // con il nome della persona come esercente si riconosce solo guardando anche la causale. La
    // ricerca locale usa `text`; verso l'esterno può andare solo `sendText`, e solo se non è un
    // segnaposto.
    const masked = maskRow({ payee: g._id.payee, description: g._id.description });
    const sendText = g._id.payee?.trim() ? masked.payee : masked.description;
    const e = merged.get(key) ?? { text, sendText, type, categoryId, subCategory1Id, count: 0 };
    e.count += g.count;
    merged.set(key, e);
  }
  return buildHistoryIndex([...merged.values()]);
}
