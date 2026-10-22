/**
 * @fileoverview Lo storico dei prezzi dei modelli: una riga ogni volta che il prezzo di un
 * modello cambia, per vedere negli anni come si muovono.
 * @module lib/models/ModelPrice
 *
 * `source`: da dove viene il prezzo — la tabella del codice (la prima riga di un modello, come
 * punto di partenza), la pagina ufficiale del fornitore letta con «Aggiorna i prezzi», o
 * l'inserimento a mano da Impostazioni → IA. `effectiveFrom` è il giorno da cui il prezzo vale:
 * per un rincaro annunciato è una data futura.
 */

import mongoose from 'mongoose';

const ModelPriceSchema = new mongoose.Schema({
  spec:          { type: String, required: true },   // "fornitore:nome"
  input:         { type: Number, required: true },   // $/MTok
  output:        { type: Number, required: true },
  cacheRead:     { type: Number, default: null },
  effectiveFrom: { type: String, required: true },   // AAAA-MM-GG
  source:        { type: String, enum: ['table', 'page', 'manual'], required: true },
  url:           { type: String, default: null },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { versionKey: false, timestamps: { createdAt: true, updatedAt: false } });

ModelPriceSchema.index({ spec: 1, effectiveFrom: 1, createdAt: 1 });

export default mongoose.models.ModelPrice || mongoose.model('ModelPrice', ModelPriceSchema);
