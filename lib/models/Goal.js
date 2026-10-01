/**
 * @fileoverview Mongoose model for Goal (obiettivo di risparmio).
 * @module lib/models/Goal
 *
 * L'obiettivo non contiene soldi propri: l'accantonato si ricalcola a ogni richiesta dai movimenti
 * e dal piano di ripartizione (vedi lib/utils/goalMath.js). Qui stanno solo i dati decisi
 * dall'utente e lo stato del ciclo di vita.
 */

import mongoose from 'mongoose';

const MONTH = [/^\d{4}-(0[1-9]|1[0-2])$/, 'Mese non valido (richiesto YYYY-MM)'];

/**
 * @typedef {Object} GoalDocument
 * @property {string}  name          - Cosa si vuole acquistare.
 * @property {number}  targetAmount  - Importo da raggiungere (> 0).
 * @property {string}  deadline      - YYYY-MM: ultimo mese utile per accantonare.
 * @property {number}  initialAmount - Soldi già da parte al momento della creazione.
 * @property {string}  createdMonth  - YYYY-MM: primo mese in cui l'obiettivo può ricevere quote.
 * @property {'active'|'completed'|'cancelled'} status
 * @property {string|null} closedMonth - YYYY-MM: da questo mese non riceve più quote.
 * @property {ObjectId|null} transferTo - Solo se annullato: obiettivo che riceve il disponibile.
 */

const GoalSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    targetAmount:  { type: Number, required: true, min: [1, 'L\'importo deve essere maggiore di zero'] },
    deadline:      { type: String, required: true, match: MONTH },
    initialAmount: { type: Number, default: 0, min: [0, 'Il già accantonato non può essere negativo'] },
    createdMonth:  { type: String, required: true, match: MONTH },
    status:        { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    closedMonth:   { type: String, default: null, match: MONTH },
    transferTo:    { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null },
  },
  { timestamps: true },
);

GoalSchema.index({ status: 1, deadline: 1 });

export default mongoose.models.Goal || mongoose.model('Goal', GoalSchema);
