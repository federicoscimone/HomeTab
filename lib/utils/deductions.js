/**
 * @fileoverview Le spese detraibili dell'anno, per il 730: quali movimenti, di che tipo, e se il
 * pagamento le rende detraibili. Solo regole e somme, provate nei test.
 * @module lib/utils/deductions
 *
 * L'app non calcola la detrazione: percentuali, franchigie e limiti cambiano ogni anno e
 * dipendono dal reddito. Prepara i totali per tipo e l'elenco dei movimenti da tenere pronti.
 *
 * Tracciabilità (legge di bilancio 2020, commi 679-680): le detrazioni al 19% richiedono un
 * pagamento tracciabile. Fanno eccezione medicinali, dispositivi medici e prestazioni di strutture
 * pubbliche o accreditate al SSN: per le spese sanitarie in contanti l'app non può sapere quale
 * sia il caso e le segna «da verificare»; le altre in contanti restano fuori dal totale.
 */

export const DEDUCTION_TYPES = ['health', 'vet', 'education', 'childcare', 'sport_kids', 'mortgage', 'insurance', 'other'];
/** Unico metodo non tracciabile fra quelli dell'app; buoni e voucher non pagano spese detraibili. */
const UNTRACEABLE = ['cash'];

/** Corrispondenza predefinita per le categorie del seed: le altre si scelgono dalla pagina. */
const DEFAULTS = {
  Salute: 'health',
  'Animali::Veterinario': 'vet',
  'Studio::Corsi': 'education',
};

/** @returns {string|null} Il tipo predefinito per una categoria del seed, o null. */
export function defaultDeduction(parentName, childName = null) {
  return DEFAULTS[childName ? `${parentName}::${childName}` : parentName] ?? null;
}

/**
 * Il tipo di detrazione di un movimento: la sua scelta se c'è («none» = escluso a mano), altrimenti
 * la categoria più specifica che ne indica uno.
 *
 * @param {Map<string, { deduction?: string|null }>} byId
 * @param {{ deduction?: string|null, categoryId?: any, subCategory1Id?: any, subCategory2Id?: any }} m
 * @returns {string|null}
 */
export function movementDeduction(byId, m) {
  if (m.deduction === 'none') return null;
  if (m.deduction) return m.deduction;
  for (const id of [m.subCategory2Id, m.subCategory1Id, m.categoryId]) {
    const type = id ? byId.get(String(id))?.deduction : null;
    if (type) return type;
  }
  return null;
}

/** @returns {'ok'|'check'|'cash'} ok tracciabile; check sanitaria in contanti; cash non detraibile. */
export function traceability(type, paymentMethod) {
  if (!UNTRACEABLE.includes(paymentMethod)) return 'ok';
  return type === 'health' ? 'check' : 'cash';
}

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * @param {object[]} movements - Uscite dell'anno.
 * @param {Map<string, object>} byId - Categorie per id.
 */
export function summarizeDeductions(movements, byId) {
  const rows = [];
  for (const m of movements) {
    const type = movementDeduction(byId, m);
    if (!type) continue;
    rows.push({ ...m, deductionType: type, status: traceability(type, m.paymentMethod) });
  }
  const types = DEDUCTION_TYPES.map((type) => {
    const list = rows.filter((r) => r.deductionType === type);
    const sum = (status) => round2(list.filter((r) => status.includes(r.status)).reduce((s, r) => s + r.amount, 0));
    return {
      type,
      count: list.length,
      total: sum(['ok', 'check']),
      toCheck: sum(['check']),
      excludedCash: sum(['cash']),
    };
  }).filter((t) => t.count > 0);
  return { types, rows: rows.sort((a, b) => a.date.localeCompare(b.date)) };
}
