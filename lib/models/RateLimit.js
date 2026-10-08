/**
 * @fileoverview Contatori a finestra fissa per limitare i tentativi (login, invio di codici).
 * @module lib/models/RateLimit
 *
 * Il contatore vive su Mongo e non in memoria: su Vercel ogni richiesta può arrivare a
 * un'istanza diversa, e un conteggio in memoria non limiterebbe nulla.
 */

import mongoose from 'mongoose';

const RateLimitSchema = new mongoose.Schema({
  _id:       { type: String },            // "<azione>:<chiave>:<inizio finestra>"
  count:     { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RateLimit || mongoose.model('RateLimit', RateLimitSchema);
