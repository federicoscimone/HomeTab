/**
 * @fileoverview Una scadenza di pagamento: bolletta, tassa, polizza, abbonamento, rata.
 * @module lib/models/Deadline
 *
 * `nextDate` è la prossima volta che va pagata; segnandola pagata avanza di `everyMonths`
 * (una scadenza una tantum si chiude). Le scadenze non mensili hanno una quota da accantonare
 * ogni mese, così una spesa annuale non arriva tutta insieme. Vedi lib/utils/deadlines.js.
 */

import mongoose from 'mongoose';
import { DEADLINE_KINDS, PERIODS } from '../utils/deadlines.js';

export { DEADLINE_KINDS, PERIODS };

const DeadlineSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 100 },
  kind:        { type: String, enum: DEADLINE_KINDS, default: 'bill' },
  amount:      { type: Number, min: 0, default: null },
  everyMonths: { type: Number, enum: [...PERIODS, null], default: 12 },
  nextDate:    { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  // Giorni di preavviso per il promemoria su Telegram; 0 = nessun promemoria.
  remindDays:  { type: Number, min: 0, max: 60, default: 7 },
  categoryId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  // Parole dell'esercente con cui riconoscere il pagamento fra i movimenti (es. "UNIPOL").
  match:       { type: String, trim: true, maxlength: 60, default: '' },
  notes:       { type: String, trim: true, maxlength: 500, default: '' },
  active:      { type: Boolean, default: true },
  // Promemoria già mandati per la scadenza corrente: 'before' (preavviso) e 'due' (il giorno).
  notified:    { type: [String], default: [] },
}, { versionKey: false, timestamps: true });

DeadlineSchema.index({ active: 1, nextDate: 1 });

export default mongoose.models.Deadline || mongoose.model('Deadline', DeadlineSchema);
