/**
 * @fileoverview Impostazioni dell'IA, modificabili dalla pagina Impostazioni → IA.
 * @module lib/models/AiSettings
 *
 * Un solo documento (`_id: 'ai'`). Un campo assente o null vuol dire "non impostato qui": vale
 * la variabile d'ambiente corrispondente, e in mancanza il valore predefinito del codice.
 *
 * Le chiavi API sono salvate **cifrate** (AES-256-GCM, lib/utils/crypto.js, chiave ricavata dal
 * segreto del server): una copia del database da sola non basta a leggerle. Accanto c'è solo
 * l'ultimo pezzo della chiave, per riconoscerla nell'interfaccia senza mai mostrarla.
 */

import mongoose from 'mongoose';

const ProviderKeySchema = new mongoose.Schema({
  apiKeyEnc: { type: String, default: null },
  hint:      { type: String, default: null },   // ultimi 4 caratteri
  updatedAt: { type: Date, default: null },
}, { _id: false });

const AiSettingsSchema = new mongoose.Schema({
  _id:              { type: String, default: 'ai' },
  importModel:      { type: String, default: null },   // "fornitore:nome" oppure "none"
  // Secondo passaggio sulle righe che il primo modello lascia senza categoria; "none" lo spegne.
  importFallbackModel: { type: String, default: null },
  importEffort:     { type: String, enum: ['low', 'medium', 'high', null], default: null },
  // La chat sui dati (fase 6).
  chatModel:        { type: String, default: null },
  chatEffort:       { type: String, enum: ['low', 'medium', 'high', null], default: null },
  monthlyBudgetUsd: { type: Number, default: null, min: 0 },
  // Suggerimenti all'apertura della revisione dell'import, senza premere il pulsante.
  importAutoSuggest: { type: Boolean, default: null },
  // Pulsante «Cerca sul web» per gli esercenti rimasti sconosciuti.
  importWebSearch: { type: Boolean, default: null },
  providers: {
    anthropic: { type: ProviderKeySchema, default: () => ({}) },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { versionKey: false, timestamps: true });

export default mongoose.models.AiSettings || mongoose.model('AiSettings', AiSettingsSchema);
