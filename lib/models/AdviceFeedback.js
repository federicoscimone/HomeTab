/**
 * @fileoverview Il giudizio della famiglia su un consiglio di risparmio: utile o non utile.
 * @module lib/models/AdviceFeedback
 *
 * Un documento per segnale (`_id` = la sua chiave, es. "recurring:NETFLIX"). Un segnale «non
 * utile» resta nascosto per HIDE_DAYS giorni; i giudizi arrivano anche al modello, che ne tiene
 * conto nella scelta.
 */

import mongoose from 'mongoose';

export const HIDE_DAYS = 180;

const AdviceFeedbackSchema = new mongoose.Schema({
  _id:       { type: String, maxlength: 200 },
  kind:      { type: String, enum: ['recurring', 'growth', 'anomaly', 'istat'], required: true },
  useful:    { type: Boolean, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { versionKey: false, timestamps: true });

export default mongoose.models.AdviceFeedback || mongoose.model('AdviceFeedback', AdviceFeedbackSchema);
