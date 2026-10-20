/**
 * @fileoverview Tetto di spesa mensile per l'IA: prenotazione prima della chiamata, saldo dopo.
 * @module lib/ai/budget
 *
 * Prima di ogni chiamata si prenota il costo massimo possibile; dopo, si sostituisce la
 * prenotazione con il costo vero. Se la prenotazione non ci sta, la chiamata non parte.
 *
 * Perché prenotare e non controllare a posteriori: controllando solo la spesa già registrata,
 * dieci richieste partite insieme a un centesimo dal tetto passerebbero tutte, e il tetto
 * verrebbe sforato di dieci chiamate. Con la prenotazione atomica passa solo quella che ci sta.
 *
 * Se il processo muore fra prenotazione e saldo, la prenotazione resta conteggiata: il contatore
 * può solo sovrastimare la spesa, mai sottostimarla.
 */

import AiBudget from '../models/AiBudget.js';

/** @returns {string} Il mese corrente in UTC, "YYYY-MM": la fatturazione di Anthropic è in UTC. */
export const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);

/**
 * Tetto mensile in micro-dollari, dal valore in dollari delle impostazioni (lib/ai/settings.js).
 * @param {number} usd
 * @returns {number} 0 se il valore non è valido: IA spenta, meglio niente che senza limite.
 */
export function capMicro(usd) {
  return Number.isFinite(usd) && usd > 0 ? Math.round(usd * 1_000_000) : 0;
}

/**
 * @typedef {Object} Reservation
 * @property {string} month
 * @property {number} micro - Importo prenotato.
 */

/**
 * Prenota `micro` sul mese corrente, solo se il totale resta entro il tetto.
 * @param {number} micro
 * @param {number} cap - Tetto in micro-dollari.
 * @returns {Promise<Reservation|null>} null se il tetto non lo permette.
 */
export async function reserve(micro, cap) {
  if (cap <= 0 || micro > cap) return null;
  const month = monthKey();

  // Il documento del mese deve esistere prima dell'aggiornamento condizionato: un upsert con
  // la condizione sul contatore, a tetto pieno, proverebbe a creare un secondo documento con lo
  // stesso _id. Due creazioni contemporanee si scontrano sull'_id: quella che perde va ignorata.
  try {
    await AiBudget.updateOne({ _id: month }, { $setOnInsert: { committedMicro: 0 } }, { upsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  const doc = await AiBudget.findOneAndUpdate(
    { _id: month, committedMicro: { $lte: cap - micro } },
    { $inc: { committedMicro: micro } },
    { returnDocument: 'after' },
  );
  return doc ? { month, micro } : null;
}

/**
 * Sostituisce la prenotazione con il costo vero.
 * Si salda sul mese della prenotazione, anche se nel frattempo il mese è cambiato.
 * @param {Reservation} reservation
 * @param {number} actualMicro
 */
export async function settle(reservation, actualMicro) {
  const delta = actualMicro - reservation.micro;
  if (delta !== 0) {
    await AiBudget.updateOne({ _id: reservation.month }, { $inc: { committedMicro: delta } });
  }
}

/**
 * @returns {Promise<{ month: string, spentMicro: number }>}
 *   `spentMicro` comprende le eventuali chiamate in corso, conteggiate al loro massimo.
 */
export async function monthSpending() {
  const month = monthKey();
  const doc = await AiBudget.findById(month).lean();
  return { month, spentMicro: doc?.committedMicro ?? 0 };
}
