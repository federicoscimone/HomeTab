/**
 * @fileoverview Mongoose model for Movement (uscite e entrate).
 * @module lib/models/Movement
 */

import mongoose from 'mongoose';
import { DEDUCTION_TYPES } from '../utils/deductions.js';

/**
 * @typedef {Object} MovementDocument
 * @property {number}  amount         - Importo in euro (> 0).
 * @property {string}  paymentMethod  - Metodo di pagamento (vedi enum).
 * @property {string}  paymentGroup   - Gruppo: 'traditional' | 'alternative'.
 * @property {string}  date           - Data in formato YYYY-MM-DD.
 * @property {string|null} time       - Ora in formato HH:mm (opzionale).
 * @property {string}  description    - Causale / descrizione libera.
 * @property {string}  place          - Luogo del pagamento.
 * @property {string}  payee          - Esercente / destinatario.
 * @property {string}  bankCategory   - Categoria assegnata dalla banca, se l'estratto la riporta.
 * @property {string}  notes          - Note aggiuntive.
 * @property {ObjectId|null} categoryId     - Riferimento Category (livello 1).
 * @property {ObjectId|null} subCategory1Id - Riferimento Category (livello 2).
 * @property {ObjectId|null} subCategory2Id - Riferimento Category (livello 3).
 * @property {'expense'|'income'} type - Tipo di movimento.
 * @property {'manual'|'import'|'telegram'}  source - Origine del record.
 * @property {string|null} importBatchId  - ID del batch di importazione.
 * @property {boolean} excludeFromAnalysis - When true, excluded from all dashboard/report aggregations.
 * @property {ObjectId|null} goalId - Obiettivo di risparmio pagato con questa spesa.
 */

const MovementSchema = new mongoose.Schema(
  {
    amount: {
      type:     Number,
      required: true,
      min:      [0.01, 'Il valore deve essere maggiore di zero'],
    },
    paymentMethod: {
      type:     String,
      required: true,
      enum: [
        'cash',
        'credit_card',
        'debit_card',
        'bank_transfer',
        'direct_debit',
        'paypal',
        'satispay',
        'meal_ticket',
        'gift_voucher',
        'fuel_voucher',
        'other_voucher',
        'other',
      ],
    },
    paymentGroup: {
      type:     String,
      required: true,
      enum:     ['traditional', 'alternative'],
    },
    /** Stored as YYYY-MM-DD string for locale-independent sorting. */
    date: {
      type:     String,
      required: true,
      match:    [/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (richiesto YYYY-MM-DD)'],
    },
    /** Optional HH:mm time. */
    time:          { type: String,  default: null, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Ora non valida (richiesto HH:mm)'] },
    description:   { type: String,  default: '', maxlength: 500, trim: true },
    place:         { type: String,  default: '', maxlength: 200, trim: true },
    payee:         { type: String,  default: '', maxlength: 200, trim: true },
    // Categoria assegnata dalla banca nell'estratto conto importato: insegna la corrispondenza
    // con le categorie della famiglia (lib/utils/bankCategoryMap.js).
    bankCategory:  { type: String,  default: '', maxlength: 100, trim: true },
    notes:         { type: String,  default: '', maxlength: 1000, trim: true },
    categoryId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subCategory1Id:{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subCategory2Id:{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    type:          { type: String,  enum: ['expense', 'income'],  default: 'expense' },
    source:        { type: String,  enum: ['manual', 'import', 'telegram'], default: 'manual' },
    /** File format used during import: xlsx, csv, or paste (copy-paste). Null for manual entries. */
    importMethod:  { type: String,  enum: ['xlsx', 'csv', 'paste', null], default: null },
    importBatchId: { type: String,  default: null },
    /** When true, this record is excluded from all dashboard and report aggregations. */
    excludeFromAnalysis: { type: Boolean, default: false },
    /**
     * Spesa con cui si acquista un obiettivo (es. il volo del viaggio). Resta nei report, perché è
     * una spesa reale, ma esce dal calcolo del risparmio e scala il disponibile dell'obiettivo:
     * altrimenti pagare il viaggio abbasserebbe il risparmio del mese e, in proporzione, anche
     * tutti gli altri obiettivi.
     */
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null },
    /** Voce del progetto (obiettivo) a cui appartiene la spesa collegata. */
    goalItemId:    { type: mongoose.Schema.Types.ObjectId, default: null },
    /** Detrazione 730: null = come la categoria, 'none' = esclusa a mano, oppure un tipo. */
    deduction:     { type: String, enum: [...DEDUCTION_TYPES, 'none', null], default: null },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────────

/** Fast range queries for reports and list pages. */
MovementSchema.index({ date: 1 });
/** Filter by type (expense/income) + date range — used in every report. */
MovementSchema.index({ type: 1, date: 1 });
/** Category breakdown queries. */
MovementSchema.index({ categoryId: 1, date: 1 });
/** Payment method analytics. */
MovementSchema.index({ paymentMethod: 1, date: 1 });
/** Batch import queries. */
MovementSchema.index({ importBatchId: 1 }, { sparse: true });
/** Spese collegate a un obiettivo. */
MovementSchema.index({ goalId: 1 }, { sparse: true });

export default mongoose.models.Movement || mongoose.model('Movement', MovementSchema);
