/**
 * @fileoverview I capitoli di spesa ISTAT (divisioni COICOP 2018) e la loro corrispondenza con le
 * categorie dell'app.
 * @module lib/utils/coicop
 *
 * Il confronto con le famiglie simili somma le spese per capitolo: ogni categoria indica il suo
 * (campo `coicop`), una sottocategoria può indicarne uno diverso dalla madre («Utenze → Internet»
 * è comunicazione, non casa) e, se non lo indica, eredita quello della madre. Una categoria senza
 * capitolo resta fuori dal confronto, e la pagina lo dice con l'importo escluso.
 */

/** Le tredici divisioni COICOP 2018, nell'ordine di ISTAT. */
export const DIVISIONS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'];

/** La casa: ISTAT vi include gli affitti figurativi (042), che il confronto toglie. */
export const HOUSING = '04';

/**
 * Corrispondenza per le categorie create dal seed, per nome: «Madre» o «Madre::Figlia».
 * Una figlia assente eredita la madre; una madre assente resta fuori dal confronto (Regali, Altro).
 */
const DEFAULTS = {
  Utenze: '04',
  'Utenze::Internet': '08',
  'Utenze::Telefono': '08',
  Spesa: '01',
  Carburante: '07',
  'Cibo Pronto': '11',
  Salute: '06',
  'Shopping::Abbigliamento': '03',
  'Shopping::Casa': '05',
  'Shopping::Elettronica': '08',
  'Shopping::Sport': '09',
  Vacanze: '09',
  'Vacanze::Alloggio': '11',
  'Vacanze::Vitto': '11',
  'Vacanze::Trasporti': '07',
  Affitto: '04',
  Studio: '10',
  'Studio::Libri': '09',
  'Studio::Software': '08',
  Animali: '09',
  Intrattenimento: '09',
  Trasporti: '07',
};

/**
 * @param {string} parentName - Nome della categoria di primo livello.
 * @param {string|null} [childName] - Nome della sottocategoria, se è una sottocategoria.
 * @returns {string|null} Il capitolo predefinito, o null (eredita, o resta fuori).
 */
export function defaultCoicop(parentName, childName = null) {
  if (childName) return DEFAULTS[`${parentName}::${childName}`] ?? null;
  return DEFAULTS[parentName] ?? null;
}

/**
 * Il capitolo di un movimento: quello della categoria più specifica che ne indica uno.
 *
 * @param {Map<string, { coicop?: string|null }>} byId - Categorie per id (stringa).
 * @param {{ categoryId?: any, subCategory1Id?: any, subCategory2Id?: any }} movement
 * @returns {string|null}
 */
export function movementDivision(byId, { categoryId, subCategory1Id, subCategory2Id }) {
  for (const id of [subCategory2Id, subCategory1Id, categoryId]) {
    const code = id ? byId.get(String(id))?.coicop : null;
    if (code) return code;
  }
  return null;
}
