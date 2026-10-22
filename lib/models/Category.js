/**
 * @fileoverview Mongoose model for Category (sistema gerarchico a 3 livelli).
 * @module lib/models/Category
 */

import mongoose from 'mongoose';
import { DIVISIONS } from '../utils/coicop.js';
import { DEDUCTION_TYPES } from '../utils/deductions.js';

/**
 * @typedef {Object} CategoryDocument
 * @property {string}       name     - Nome della categoria (unico per livello + genitore).
 * @property {string}       color    - Colore hex (#rrggbb).
 * @property {string}       icon     - Nome icona (lucide / stringa libera).
 * @property {1|2|3}        level    - Livello gerarchico: 1=root, 2=sub, 3=sub-sub.
 * @property {ObjectId|null} parentId - Riferimento alla categoria padre (null per livello 1).
 * @property {number}       order    - Ordinamento all'interno del livello.
 * @property {string|null}  coicop   - Capitolo ISTAT per il confronto con le famiglie simili;
 *                                     null = eredita dalla madre, o resta fuori dal confronto.
 */

const CategorySchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    color:    { type: String, default: '#6366f1', match: [/^#[0-9a-fA-F]{6}$/, 'Colore non valido'] },
    icon:     { type: String, default: 'tag', maxlength: 50 },
    level:    { type: Number, enum: [1, 2, 3], default: 1 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    order:    { type: Number, default: 0, min: 0 },
    coicop:   { type: String, enum: [...DIVISIONS, null], default: null },
    // Tipo di spesa detraibile per il 730; null = eredita dalla madre, o non detraibile.
    deduction: { type: String, enum: [...DEDUCTION_TYPES, null], default: null },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────

/** Hierarchical queries: find all children of a parent. */
CategorySchema.index({ parentId: 1, level: 1, order: 1 });
/** Root category listing (level 1, sorted). */
CategorySchema.index({ level: 1, order: 1 });

export default mongoose.models.Category || mongoose.model('Category', CategorySchema);
