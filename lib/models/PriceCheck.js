/**
 * @fileoverview Il risultato di «Aggiorna i prezzi», in attesa che un amministratore lo applichi.
 * @module lib/models/PriceCheck
 *
 * Si applica per id, non con i valori rimandati dal browser: ciò che si salva è esattamente ciò
 * che il server ha letto e verificato. Scade da solo dopo un giorno.
 */

import mongoose from 'mongoose';

const PriceCheckSchema = new mongoose.Schema({
  changes:   { type: [Object], default: [] },   // { spec, url, current, found, upcoming }
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  appliedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, expires: 86_400 },
}, { versionKey: false });

export default mongoose.models.PriceCheck || mongoose.model('PriceCheck', PriceCheckSchema);
