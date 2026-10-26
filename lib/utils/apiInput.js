/**
 * @fileoverview Aiuti per le route che scrivono documenti: campi ammessi ed errori di input.
 * @module lib/utils/apiInput
 *
 * Le route delle impostazioni passavano il corpo della richiesta a create/findByIdAndUpdate
 * così com'era. Un campo non previsto finiva nel documento, e un dato non valido faceva fallire
 * la validazione di Mongoose con un 500 in HTML: nel browser res.json() falliva a sua volta e lo
 * spinner del pulsante restava acceso.
 */

/**
 * @param {unknown} body - Corpo JSON della richiesta.
 * @param {string[]} keys - Campi che il client può impostare.
 * @returns {object} Solo le chiavi elencate e presenti.
 *
 * @example
 * pick({ name: 'Casa', _id: 'x' }, ['name', 'color']) // { name: 'Casa' }
 */
export function pick(body, keys) {
  const out = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return out;
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

/**
 * Errore causato dai dati inviati (validazione o tipo sbagliato), da restituire come 400.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export const isInputError = (err) => err?.name === 'ValidationError' || err?.name === 'CastError';

/** Campi di una regola keyword → categoria che il client può impostare. */
export const KEYWORD_FIELDS = ['keyword', 'categoryId', 'subCategory1Id', 'priority', 'caseSensitive'];

/** Campi di un template di import che il client può impostare. */
export const TEMPLATE_FIELDS = [
  'name', 'fileType', 'skipRows', 'delimiter', 'dateFormat', 'columnMapping',
  'amountDebit', 'amountCredit', 'amountSign', 'defaultPaymentMethod', 'payeeMethodKeywords',
];

/**
 * Pagina e dimensione della pagina dai parametri dell'URL. Con parseInt da solo «?limit=abc»
 * diventava NaN e «?limit=0» una pagina vuota con infinite pagine: arrivavano così a Mongo.
 *
 * @param {URLSearchParams} searchParams
 * @param {number} defaultLimit
 * @returns {{ page: number, limit: number }} page ≥ 1, limit fra 1 e 100.
 */
export function pagination(searchParams, defaultLimit) {
  const int = (name) => Number.parseInt(searchParams.get(name), 10);
  const page = Math.max(1, int('page') || 1);
  const limit = Math.min(100, Math.max(1, int('limit') || defaultLimit));
  return { page, limit };
}
