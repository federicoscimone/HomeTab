/**
 * @fileoverview Campi di un movimento accettati dalle API, validati e normalizzati.
 * @module lib/utils/movementInput
 *
 * Le route passavano il corpo della richiesta al modello così com'era, e il PATCH addirittura a
 * $set senza validatori: chi aveva il permesso di modifica poteva scrivere qualunque campo
 * (origine, batch di import, una data in formato libero) e aggirare la regola che lega un
 * obiettivo solo alle uscite tradizionali. Qui si decide cosa entra; il resto viene ignorato.
 *
 * Nessuna dipendenza da Mongoose, così la validazione si prova con node --test.
 */

import { PAYMENT_METHODS, getPaymentGroup } from './payments.js';

const METHODS = new Set(PAYMENT_METHODS.map((m) => m.value));
const TYPES = new Set(['expense', 'income']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** Campi di testo e lunghezza massima, gli stessi limiti del modello. */
const TEXT_LIMITS = { description: 500, place: 200, payee: 200, notes: 1000 };
const REF_FIELDS = ['categoryId', 'subCategory1Id', 'subCategory2Id', 'goalId', 'goalItemId'];

/**
 * @typedef {Object} MovementData
 * @property {number} amount
 * @property {string} paymentMethod
 * @property {'traditional'|'alternative'} paymentGroup - Derivato dal metodo, mai dal client.
 * @property {string} date - YYYY-MM-DD.
 * @property {string|null} time - HH:mm.
 * @property {'expense'|'income'} type
 * @property {string} description
 * @property {string} place
 * @property {string} payee
 * @property {string} notes
 * @property {string|null} categoryId
 * @property {string|null} subCategory1Id
 * @property {string|null} subCategory2Id
 * @property {string|null} goalId
 * @property {string|null} goalItemId
 * @property {boolean} excludeFromAnalysis
 */

/**
 * @param {unknown} body - Corpo JSON di POST /api/movimenti o PUT /api/movimenti/[id].
 * @returns {{ data: MovementData, error?: undefined } | { error: string, data?: undefined }}
 *   error è una chiave del namespace "errors" di messages/*.json.
 *
 * @example
 * movementInput({ amount: '12.5', paymentMethod: 'cash', date: '2026-10-07' }).data.amount // 12.5
 * movementInput({ amount: 0, paymentMethod: 'cash', date: '2026-10-07' }).error // 'invalidAmount'
 */
export function movementInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalidMovement' };

  const amount = typeof body.amount === 'string' ? Number(body.amount) : body.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return { error: 'invalidAmount' };
  if (!METHODS.has(body.paymentMethod)) return { error: 'invalidPaymentMethod' };
  if (typeof body.date !== 'string' || !DATE_RE.test(body.date)) return { error: 'invalidDate' };

  const time = body.time || null;
  if (time !== null && (typeof time !== 'string' || !TIME_RE.test(time))) return { error: 'invalidTime' };

  const type = body.type ?? 'expense';
  if (!TYPES.has(type)) return { error: 'invalidType' };

  const data = {
    amount,
    paymentMethod: body.paymentMethod,
    paymentGroup: getPaymentGroup(body.paymentMethod),
    date: body.date,
    time,
    type,
    excludeFromAnalysis: body.excludeFromAnalysis === true,
  };

  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    const value = body[field] ?? '';
    if (typeof value !== 'string') return { error: 'invalidMovement' };
    if (value.trim().length > max) return { error: 'textTooLong' };
    data[field] = value.trim();
  }

  // Un riferimento vuoto o non valido diventa null: le select del form mandano '' per "nessuno".
  for (const field of REF_FIELDS) {
    data[field] = typeof body[field] === 'string' && OBJECT_ID_RE.test(body[field]) ? body[field] : null;
  }

  // Solo un'uscita tradizionale può pagare un obiettivo: è l'unica che entra nel risparmio.
  if (data.type !== 'expense' || data.paymentGroup !== 'traditional') data.goalId = null;
  // Una voce senza obiettivo non ha senso: si toglie insieme all'obiettivo.
  if (!data.goalId) data.goalItemId = null;

  return { data };
}

/**
 * Il PATCH serve solo a includere o escludere un movimento dalle analisi, dalla lista: accetta
 * quel campo e nient'altro, invece di girare il corpo a $set.
 *
 * @param {unknown} body
 * @returns {{ data: { excludeFromAnalysis: boolean } } | { error: string }}
 */
export function movementPatchInput(body) {
  const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
  if (keys.length !== 1 || typeof body.excludeFromAnalysis !== 'boolean') return { error: 'invalidPatch' };
  return { data: { excludeFromAnalysis: body.excludeFromAnalysis } };
}
