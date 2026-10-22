/**
 * @fileoverview Una proposta scartata con «Ignora», perché non torni a ogni visita.
 * @module lib/models/DismissedSuggestion
 *
 * `_id` è il tipo di proposta più la sua chiave, es. "deadline:COMUNE MILANO".
 */

import mongoose from 'mongoose';

const DismissedSuggestionSchema = new mongoose.Schema({
  _id: { type: String, maxlength: 200 },
  dismissedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { versionKey: false, timestamps: true });

export default mongoose.models.DismissedSuggestion || mongoose.model('DismissedSuggestion', DismissedSuggestionSchema);
