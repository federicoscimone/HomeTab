/**
 * @fileoverview Mongoose model for ImportTemplate — saved column-mapping configs.
 * @module lib/models/ImportTemplate
 */

import mongoose from 'mongoose';

/**
 * @typedef {Object} ColumnMapping
 * @property {string|null} date        - Column letter/index for date.
 * @property {string|null} amount      - Column letter/index for amount (single-column mode).
 * @property {string|null} description - Column letter/index for description/causale.
 * @property {string|null} payee       - Column letter/index for payee/esercente.
 * @property {string|null} place       - Column letter/index for place.
 * @property {string|null} notes       - Column letter/index for notes.
 */

/**
 * @typedef {Object} ImportTemplateDocument
 * @property {string}        name           - Display name of the template.
 * @property {'xlsx'|'csv'|'paste'} fileType - Source file type.
 * @property {number}        skipRows       - Header rows to skip before data.
 * @property {string}        delimiter      - CSV column delimiter (e.g. ";", ",").
 * @property {string}        dateFormat     - Date format string (e.g. "DD/MM/YYYY").
 * @property {ColumnMapping} columnMapping  - Per-field column references.
 * @property {string|null}   amountDebit    - Debit column (split debit/credit mode).
 * @property {string|null}   amountCredit   - Credit column (split debit/credit mode).
 * @property {'absolute'|'negative_is_income'|'negative_is_expense'} amountSign
 *   - How to interpret the sign of a single amount column.
 */

const ImportTemplateSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    fileType:  { type: String, enum: ['xlsx', 'csv', 'paste'], default: 'xlsx' },
    skipRows:  { type: Number, default: 0, min: 0 },
    delimiter: { type: String, default: ';', maxlength: 5 },
    dateFormat:{ type: String, default: 'DD/MM/YYYY', maxlength: 20 },
    columnMapping: {
      date:        { type: String, default: null },
      amount:      { type: String, default: null },
      description: { type: String, default: null },
      payee:       { type: String, default: null },
      place:       { type: String, default: null },
      notes:       { type: String, default: null },
    },
    amountDebit:  { type: String, default: null },
    amountCredit: { type: String, default: null },
    /**
     * Sign interpretation for single-column amount mode:
     * - `absolute`            — always positive; type determined manually.
     * - `negative_is_income`  — negative value → income, positive → expense.
     * - `negative_is_expense` — negative value → expense, positive → income.
     */
    amountSign: {
      type:    String,
      enum:    ['absolute', 'negative_is_income', 'negative_is_expense'],
      default: 'absolute',
    },
  },
  { timestamps: true },
);

export default mongoose.models.ImportTemplate || mongoose.model('ImportTemplate', ImportTemplateSchema);
