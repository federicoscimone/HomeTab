/**
 * @fileoverview Il confronto con le famiglie simili: le vostre spese per capitolo accanto alla
 * media ISTAT per la vostra regione e il vostro numero di componenti.
 * @module lib/services/istatCompare
 *
 * Usato dalla pagina Report → Famiglie simili e dallo strumento confronto_istat della chat, con gli
 * stessi numeri. I dati ISTAT vengono dall'istantanea versionata nel repo, mai da una chiamata.
 *
 * Le spese contano tutti i metodi di pagamento (anche i buoni pasto sono spesa alimentare) e
 * lasciano fuori i movimenti esclusi dalle analisi, come i report.
 */

import Category from '../models/Category.js';
import HouseholdProfile from '../models/HouseholdProfile.js';
import Movement from '../models/Movement.js';
import snapshot from '../../data/istat/spese-famiglie.js';
import { DIVISIONS, movementDivision } from '../utils/coicop.js';
import { compareWithIstat, comparisonWindow, istatReference } from '../utils/istat.js';

/** @returns {Promise<{ region: string|null, members: number|null }>} */
export async function loadHouseholdProfile() {
  const doc = await HouseholdProfile.findById('household').lean();
  return { region: doc?.region ?? null, members: doc?.members ?? null };
}

/**
 * @param {{ now?: Date }} [options]
 */
export async function istatComparison({ now = new Date() } = {}) {
  const base = { type: 'expense', excludeFromAnalysis: { $ne: true } };
  const [profile, first, categories] = await Promise.all([
    loadHouseholdProfile(),
    Movement.findOne(base).sort({ date: 1 }).select('date').lean(),
    Category.find().select('name level parentId coicop').lean(),
  ]);
  const period = comparisonWindow(now, first?.date ?? null);
  const groups = period.months > 0
    ? await Movement.aggregate([
      { $match: { ...base, date: { $gte: period.from, $lte: period.to } } },
      { $group: { _id: { c: '$categoryId', s1: '$subCategory1Id', s2: '$subCategory2Id' }, total: { $sum: '$amount' } } },
    ])
    : [];

  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const reference = istatReference(snapshot, profile, [...DIVISIONS, 'ALL']);
  const result = compareWithIstat({
    groups,
    byId,
    months: period.months,
    reference,
    divisions: DIVISIONS,
    divisionOf: (ids) => movementDivision(byId, { categoryId: ids.c, subCategory1Id: ids.s1, subCategory2Id: ids.s2 }),
  });

  return {
    istatYear: snapshot.year,
    profile,
    profileComplete: Boolean(profile.region && profile.members),
    period,
    ...result,
  };
}
