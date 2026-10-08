/**
 * @fileoverview Codice monouso inviato su Telegram o via email (login, reset, attivazione 2FA).
 * @module lib/models/OtpChallenge
 *
 * Del codice si salva solo l'hash: chi legge il database non può usarlo. Per il login c'è anche
 * un ticket, consegnato al browser dopo la password e anch'esso salvato come hash: lega il codice
 * alla verifica della password già fatta, così il secondo passo non la richiede di nuovo.
 */

import mongoose from 'mongoose';

const OtpChallengeSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose:    { type: String, enum: ['login', 'reset', 'enable'], required: true },
  channel:    { type: String, enum: ['telegram', 'email'], required: true },
  codeHash:   { type: String, required: true },
  ticketHash: { type: String, default: null, index: true },
  attempts:   { type: Number, default: 0 },
  usedAt:     { type: Date, default: null },
  expiresAt:  { type: Date, required: true },
}, { timestamps: true });

// MongoDB elimina da sé i codici scaduti.
OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.OtpChallenge || mongoose.model('OtpChallenge', OtpChallengeSchema);
