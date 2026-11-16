/**
 * @fileoverview Movimenti già presenti con cui confrontare le righe di un import
 * (lib/utils/split.js, isDuplicateOf). Usato dall'anteprima e dal salvataggio.
 */

import Movement from '@/lib/models/Movement';

/**
 * I movimenti delle date dell'import, raggruppati per data.
 * @param {{ date: string }[]} keys
 * @returns {Promise<Map<string, object[]>>}
 */
export async function loadCandidates(keys) {
  const dates = [...new Set(keys.map((k) => k.date).filter((d) => typeof d === 'string'))];
  const found = await Movement.find(
    { date: { $in: dates } },
    { date: 1, amount: 1, description: 1, payee: 1, split: 1 },
  ).lean();
  const byDate = new Map();
  for (const m of found) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date).push(m);
  }
  return byDate;
}
