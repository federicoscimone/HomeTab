/**
 * @fileoverview Token monouso per collegare una chat Telegram a un utente.
 * @module lib/models/TelegramLink
 *
 * Un bot non può scrivere per primo: l'utente apre t.me/<bot>?start=<token> e il bot, ricevuto
 * "/start <token>", sa a quale utente appartiene la chat. Del token si salva solo l'hash.
 */

import mongoose from 'mongoose';

const TelegramLinkSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

TelegramLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.TelegramLink || mongoose.model('TelegramLink', TelegramLinkSchema);
