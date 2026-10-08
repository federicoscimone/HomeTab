/**
 * @fileoverview Contatore mensile della spesa per l'IA, uno per mese.
 * @module lib/models/AiBudget
 *
 * Un solo numero per mese, `committedMicro`: la spesa vera delle chiamate concluse più le
 * prenotazioni di quelle in corso, in micro-dollari. È un contatore unico apposta: il controllo
 * "c'è ancora spazio?" e l'incremento avvengono in un solo aggiornamento atomico di Mongo, quindi
 * due richieste contemporanee non possono passare entrambe sull'ultimo margine rimasto.
 */

import mongoose from 'mongoose';

const AiBudgetSchema = new mongoose.Schema({
  _id:            { type: String },            // "2026-10" (mese UTC, come la fatturazione)
  committedMicro: { type: Number, default: 0 },
}, { versionKey: false, timestamps: true });

export default mongoose.models.AiBudget || mongoose.model('AiBudget', AiBudgetSchema);
