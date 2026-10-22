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
 * @property {{ name: string, budget: number, quote: number|null }[]} items - Voci del progetto.
 * @property {{ text: string, due: string|null, done: boolean }[]} tasks - Cose da fare.
 */

/** Una voce del progetto: quanto si vuole spendere e, se c'è, il preventivo ricevuto. */
const ItemSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true, maxlength: 100 },
  budget: { type: Number, required: true, min: 0 },
  quote:  { type: Number, min: 0, default: null },
});

/** Una cosa da fare per il progetto, con una data se serve. */
const TaskSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 200 },
  due:  { type: String, default: null, match: [/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'] },
  done: { type: Boolean, default: false },
});

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
    // Facoltativi: un obiettivo diventa un progetto con voci di budget e cose da fare.
    items:         { type: [ItemSchema], default: [] },
    tasks:         { type: [TaskSchema], default: [] },
  },
  { timestamps: true },
);

GoalSchema.index({ status: 1, deadline: 1 });

export default mongoose.models.Goal || mongoose.model('Goal', GoalSchema);
