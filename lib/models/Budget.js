/**
 * @fileoverview Il budget mensile di una categoria di primo livello.
 * @module lib/models/Budget
 *
 * `notified` ricorda le soglie già avvisate su Telegram nel mese, così un avviso parte una volta.
 */

import mongoose from 'mongoose';

const BudgetSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, unique: true },
  amount:     { type: Number, required: true, min: 1 },
  notified: {
    month:  { type: String, default: null },
    levels: { type: [Number], default: [] },
  },
}, { versionKey: false, timestamps: true });

export default mongoose.models.Budget || mongoose.model('Budget', BudgetSchema);
