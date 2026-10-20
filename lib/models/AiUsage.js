/**
 * @fileoverview Registro delle chiamate ai modelli: una riga per chiamata, con token e costo.
 * @module lib/models/AiUsage
 *
 * Serve a vedere dove va la spesa e a misurare i modelli (fase 5). Non contiene il testo
 * inviato né la risposta: solo numeri, così il registro non diventa una copia dei movimenti.
 */

import mongoose from 'mongoose';

const AiUsageSchema = new mongoose.Schema({
  task:             { type: String, required: true },  // es. "importCategorize"
  model:            { type: String, required: true },  // "anthropic:claude-haiku-5-5"
  outcome:          { type: String, enum: ['ok', 'invalid', 'error', 'unknown'], required: true },
  inputTokens:      { type: Number, default: 0 },      // senza i token di cache
  outputTokens:     { type: Number, default: 0 },
  cacheWriteTokens: { type: Number, default: 0 },
  cacheReadTokens:  { type: Number, default: 0 },
  webSearches:      { type: Number, default: 0 },      // ricerche web, 10 $ ogni 1.000
  costMicro:        { type: Number, default: 0 },      // addebitato al contatore del mese
  reservedMicro:    { type: Number, default: 0 },      // prenotato prima della chiamata
  durationMs:       { type: Number, default: 0 },
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  error:            { type: String, default: null, maxlength: 500 },
}, { versionKey: false, timestamps: { createdAt: true, updatedAt: false } });

/**
 * Tredici mesi bastano per confrontare un mese con lo stesso dell'anno prima. Lo stesso indice
 * serve anche a ordinare le ultime chiamate: Mongo lo percorre in entrambe le direzioni.
 */
AiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 3600, name: 'ttl' });

export default mongoose.models.AiUsage || mongoose.model('AiUsage', AiUsageSchema);
