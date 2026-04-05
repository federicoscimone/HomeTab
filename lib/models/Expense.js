/**
 * @fileoverview Mongoose model for Expense (uscite e entrate).
 * @module lib/models/Expense
 */

import mongoose from 'mongoose';

/**
 * @typedef {Object} ExpenseDocument
 * @property {number}  amount         - Importo in euro (> 0).
 * @property {string}  paymentMethod  - Metodo di pagamento (vedi enum).
 * @property {string}  paymentGroup   - Gruppo: 'traditional' | 'alternative'.
 * @property {string}  date           - Data in formato YYYY-MM-DD.
 * @property {string|null} time       - Ora in formato HH:mm (opzionale).
 * @property {string}  description    - Causale / descrizione libera.
 * @property {string}  place          - Luogo del pagamento.
 * @property {string}  payee          - Esercente / destinatario.
 * @property {string}  notes          - Note aggiuntive.
 * @property {ObjectId|null} categoryId     - Riferimento Category (livello 1).
 * @property {ObjectId|null} subCategory1Id - Riferimento Category (livello 2).
 * @property {ObjectId|null} subCategory2Id - Riferimento Category (livello 3).
 * @property {'expense'|'income'} type - Tipo di movimento.
 * @property {'manual'|'import'}  source - Origine del record.
 * @property {string|null} importBatchId  - ID del batch di importazione.
 * @property {boolean} excludeFromAnalysis - When true, excluded from all dashboard/report aggregations.
 */

const ExpenseSchema = new mongoose.Schema(
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
    notes:         { type: String,  default: '', maxlength: 1000, trim: true },
    categoryId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subCategory1Id:{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subCategory2Id:{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    type:          { type: String,  enum: ['expense', 'income'],  default: 'expense' },
    source:        { type: String,  enum: ['manual', 'import'],   default: 'manual' },
    importBatchId: { type: String,  default: null },
    /** When true, this record is excluded from all dashboard and report aggregations. */
    excludeFromAnalysis: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// These are the most common query patterns in the app.

/** Fast range queries for reports and list pages. */
ExpenseSchema.index({ date: 1 });
/** Filter by type (expense/income) + date range — used in every report. */
ExpenseSchema.index({ type: 1, date: 1 });
/** Category breakdown queries. */
ExpenseSchema.index({ categoryId: 1, date: 1 });
/** Payment method analytics. */
ExpenseSchema.index({ paymentMethod: 1, date: 1 });
/** Batch import queries. */
ExpenseSchema.index({ importBatchId: 1 }, { sparse: true });

export default mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
