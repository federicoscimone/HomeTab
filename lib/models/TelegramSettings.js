/**
 * @fileoverview Bot Telegram configurato da Impostazioni → Telegram.
 * @module lib/models/TelegramSettings
 *
 * Un solo documento (`_id: 'telegram'`). Senza documento, o senza token, valgono le variabili
 * d'ambiente (TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET).
 *
 * Token e segreto del webhook sono salvati **cifrati** (lib/utils/crypto.js, chiave ricavata dal
 * segreto del server), come le chiavi dell'IA: una copia del database da sola non basta a usarli.
 * Del token resta in chiaro solo l'ultimo pezzo, per riconoscerlo nell'interfaccia.
 *
 * Solo import relativi: lo legge anche workers/telegram.js, fuori da Next.
 */

import mongoose from 'mongoose';

const TelegramSettingsSchema = new mongoose.Schema({
  _id:              { type: String, default: 'telegram' },
  tokenEnc:         { type: String, default: null },
  tokenHint:        { type: String, default: null },   // ultimi 4 caratteri
  // Dal getMe del Bot API al salvataggio: il nome non si scrive a mano, si legge dal token.
  botUsername:      { type: String, default: null },
  botName:          { type: String, default: null },
  /** polling: l'app chiede i messaggi (rete di casa); webhook: Telegram li manda (istanza pubblica). */
  mode:             { type: String, enum: ['polling', 'webhook'], default: 'polling' },
  webhookSecretEnc: { type: String, default: null },
}, { versionKey: false, timestamps: true });

export default mongoose.models.TelegramSettings || mongoose.model('TelegramSettings', TelegramSettingsSchema);
