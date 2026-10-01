/**
 * @fileoverview Mongoose model for AllocationPlan (ripartizione del risparmio tra gli obiettivi).
 * @module lib/models/AllocationPlan
 *
 * Il piano è versionato: ogni modifica crea (o sostituisce) la versione che parte dal mese in
 * corso, e i mesi già chiusi restano ripartiti con la versione che era in vigore allora.
 * Un campo "percentuale" sull'obiettivo sarebbe stato più semplice, ma cambiarlo avrebbe
 * riscritto anche quanto ogni obiettivo aveva accumulato nei mesi passati.
 */

import mongoose from 'mongoose';

const ShareSchema = new mongoose.Schema(
  {
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true },
    pct:    { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const AllocationPlanSchema = new mongoose.Schema(
  {
    /** YYYY-MM: primo mese ripartito con questa versione. */
    effectiveFrom: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Mese non valido (richiesto YYYY-MM)'],
    },
    shares: {
      type: [ShareSchema],
      validate: {
        validator: (shares) => shares.reduce((s, x) => s + x.pct, 0) <= 100,
        message: 'La somma delle percentuali non può superare 100',
      },
    },
  },
  { timestamps: true },
);

export default mongoose.models.AllocationPlan || mongoose.model('AllocationPlan', AllocationPlanSchema);
