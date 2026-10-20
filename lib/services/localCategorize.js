/**
 * @fileoverview Categorie proposte in locale, senza IA: la catena usata dall'import e dalla
 * revisione dei movimenti incompleti.
 * @module lib/services/localCategorize
 *
 * Dalla fonte più specifica alla più generale:
 * 1. le parole chiave (regole esplicite, in Impostazioni → Keyword Mapping);
 * 2. l'esercente nello storico, cioè come la famiglia l'ha già categorizzato;
 * 3. la categoria assegnata dalla banca, tradotta con quello che lo storico ha insegnato.
 * Nulla esce dal server. Le righe che restano si possono poi mandare all'IA.
 */

import KeywordMapping from '../models/KeywordMapping.js';
import { autoCategorize } from '../utils/autoCategorize.js';
import { lookupMerchant } from '../utils/merchantHistory.js';
import { lookupBankCategory } from '../utils/bankCategoryMap.js';
import { loadBankCategoryMap, loadHistoryIndex } from './merchantHistory.js';

/**
 * @typedef {Object} LocalSuggestion
 * @property {'keyword'|'history'|'bank'} source
 * @property {string} categoryId
 * @property {string|null} subCategory1Id
 * @property {number} [support] - Movimenti passati a sostegno (storico e banca).
 * @property {string} [text]    - L'esercente passato riconosciuto (storico).
 */

/**
 * Carica regole, storico e corrispondenze della banca una volta, e restituisce la funzione che
 * propone la categoria di una riga.
 *
 * @param {{ withBank?: boolean }} [opts] - withBank: false evita di leggere le categorie della
 *   banca quando le righe non ne hanno.
 * @returns {Promise<(row: { description?: string, payee?: string, place?: string, type?: string,
 *   bankCategory?: string }) => LocalSuggestion|null>}
 */
export async function localSuggester({ withBank = true } = {}) {
  const [mappings, history, bankMap] = await Promise.all([
    KeywordMapping.find().sort({ priority: -1 }).lean(),
    loadHistoryIndex(),
    withBank ? loadBankCategoryMap() : null,
  ]);
  return (row) => {
    const kw = autoCategorize(row, mappings);
    if (kw?.categoryId) return { source: 'keyword', categoryId: kw.categoryId, subCategory1Id: kw.subCategory1Id || null };
    const hist = lookupMerchant(history, [row.description, row.payee, row.place].join(' '), row.type).match;
    if (hist) return { source: 'history', categoryId: hist.categoryId, subCategory1Id: hist.subCategory1Id, support: hist.support, text: hist.text };
    const bank = bankMap && row.bankCategory ? lookupBankCategory(bankMap, row.bankCategory, row.type) : null;
    if (bank) return { source: 'bank', categoryId: bank.categoryId, subCategory1Id: bank.subCategory1Id, support: bank.support };
    return null;
  };
}
