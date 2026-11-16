/**
 * @fileoverview Stato persistente del processo del bot Telegram.
 * @module lib/models/BotState
 *
 * getUpdates restituisce i messaggi a partire da un offset: salvarlo su Mongo evita di rileggere
 * (e rielaborare) gli stessi messaggi a ogni riavvio del processo.
 */

import mongoose from 'mongoose';

const BotStateSchema = new mongoose.Schema({
  _id:    { type: String },                // nome del bot, oppure 'receiver'
  offset: { type: Number, default: 0 },
  // Documento 'receiver': chi riceve i messaggi (lib/telegramPolling.js). Un solo processo alla
  // volta (Telegram rifiuta due getUpdates in parallelo): lo tiene chi ha il lucchetto valido.
  leaseOwner:    { type: String, default: null },
  leaseUntil:    { type: Date, default: null },
  // Per la pagina Impostazioni → Telegram: l'ultimo contatto riuscito con Telegram e l'ultimo errore.
  bot:           { type: String, default: null },
  mode:          { type: String, default: null },
  lastContactAt: { type: Date, default: null },
  lastError:     { type: String, default: null },
}, { versionKey: false, timestamps: true });

export default mongoose.models.BotState || mongoose.model('BotState', BotStateSchema);
