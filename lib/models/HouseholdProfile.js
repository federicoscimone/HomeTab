/**
 * @fileoverview Il profilo della famiglia per il confronto con i dati ISTAT.
 * @module lib/models/HouseholdProfile
 *
 * Un solo documento (`_id: 'household'`): l'app è per un solo nucleo. Servono solo la regione e il
 * numero di componenti, cioè le due dimensioni della tavola ISTAT; nient'altro della famiglia.
 */

import mongoose from 'mongoose';
import { MAX_MEMBERS, REGIONS } from '../utils/istat.js';

const HouseholdProfileSchema = new mongoose.Schema({
  _id:       { type: String, default: 'household' },
  region:    { type: String, enum: [...Object.keys(REGIONS), null], default: null },
  // 5 vale «5 o più», come nella tavola ISTAT.
  members:   { type: Number, min: 1, max: MAX_MEMBERS, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { versionKey: false, timestamps: true });

export default mongoose.models.HouseholdProfile || mongoose.model('HouseholdProfile', HouseholdProfileSchema);
