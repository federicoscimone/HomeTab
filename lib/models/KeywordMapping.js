/**
 * @fileoverview Mongoose model for KeywordMapping — auto-categorization rules.
 * @module lib/models/KeywordMapping
 */

import mongoose from 'mongoose';

/**
 * @typedef {Object} KeywordMappingDocument
 * @property {string}        keyword        - Parola chiave da cercare nella descrizione.
 * @property {ObjectId}      categoryId     - Categoria principale assegnata.
 * @property {ObjectId|null} subCategory1Id - Sotto-categoria 1 (opzionale).
 * @property {ObjectId|null} subCategory2Id - Sotto-categoria 2 (opzionale).
 * @property {boolean}       caseSensitive  - Se true, il match è case-sensitive.
 * @property {number}        priority       - Priorità (più alta = vince su altre keyword).
 */

const KeywordMappingSchema = new mongoose.Schema(
  {
    keyword:       { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    categoryId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory1Id:{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    subCategory2Id:{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    caseSensitive: { type: Boolean, default: false },
    priority:      { type: Number,  default: 10, min: 0 },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────

/** Sorting by priority for the auto-categorization engine. */
KeywordMappingSchema.index({ priority: -1 });
/** Text search on keyword (used in admin list page). */
KeywordMappingSchema.index({ keyword: 1 });

export default mongoose.models.KeywordMapping || mongoose.model('KeywordMapping', KeywordMappingSchema);
