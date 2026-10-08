/**
 * @fileoverview Stato persistente del processo del bot Telegram.
 * @module lib/models/BotState
 *
 * getUpdates restituisce i messaggi a partire da un offset: salvarlo su Mongo evita di rileggere
 * (e rielaborare) gli stessi messaggi a ogni riavvio del processo.
 */

import mongoose from 'mongoose';

const BotStateSchema = new mongoose.Schema({
  _id:    { type: String },                // nome del bot
  offset: { type: Number, default: 0 },
}, { versionKey: false, timestamps: true });

export default mongoose.models.BotState || mongoose.model('BotState', BotStateSchema);
