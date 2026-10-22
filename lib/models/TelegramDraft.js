/**
 * @fileoverview Un movimento letto da uno scontrino, in attesa che l'utente lo confermi su
 * Telegram con un pulsante. Scade da solo dopo un giorno.
 * @module lib/models/TelegramDraft
 */

import mongoose from 'mongoose';

const TelegramDraftSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chatId:   { type: String, required: true },
  movement: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86_400 },
}, { versionKey: false });

export default mongoose.models.TelegramDraft || mongoose.model('TelegramDraft', TelegramDraftSchema);
