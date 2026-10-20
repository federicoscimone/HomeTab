/**
 * @fileoverview Corrispondenza fra le categorie della banca e quelle della famiglia, imparata
 * dallo storico.
 * @module lib/utils/bankCategoryMap
 *
 * Molti estratti conto riportano una categoria scelta dalla banca («Alimentari», «Trasporti»).
 * Non coincide con quelle della famiglia, ma nello storico si vede dove sono finiti i movimenti
 * con ciascuna etichetta: se «Alimentari» è andato quasi sempre in «Spesa → Supermercato», un
 * movimento nuovo con quell'etichetta ci va da solo. Tutto in locale.
 */

/** Movimenti con quell'etichetta che servono prima di fidarsi. */
export const MIN_SUPPORT = 3;
/** Quota che deve stare nella stessa categoria della famiglia. */
export const MIN_AGREEMENT = 0.8;

/** @returns {string} L'etichetta della banca confrontabile: maiuscole e spazi normalizzati. */
export const normalizeBankCategory = (label) => String(label || '').toUpperCase().replace(/\s+/g, ' ').trim();

/**
 * @param {{ label: string, type: string, categoryId: string, subCategory1Id: string|null, count: number }[]} groups
 * @returns {Map<string, { categoryId: string, subCategory1Id: string|null, support: number, agreement: number }>}
 *   chiave `${tipo}|${ETICHETTA}`; solo le etichette con abbastanza movimenti concordi.
 */
export function buildBankCategoryMap(groups) {
  const byLabel = new Map();
  for (const g of groups) {
    const label = normalizeBankCategory(g.label);
    if (!label) continue;
    const key = `${g.type === 'income' ? 'income' : 'expense'}|${label}`;
    const votes = byLabel.get(key) ?? new Map();
    const cat = `${g.categoryId}/${g.subCategory1Id ?? ''}`;
    votes.set(cat, (votes.get(cat) ?? 0) + g.count);
    byLabel.set(key, votes);
  }
  const map = new Map();
  for (const [key, votes] of byLabel) {
    const total = [...votes.values()].reduce((a, b) => a + b, 0);
    const [best, n] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (total >= MIN_SUPPORT && n / total >= MIN_AGREEMENT) {
      const [categoryId, sub] = best.split('/');
      map.set(key, { categoryId, subCategory1Id: sub || null, support: n, agreement: Math.round((n / total) * 100) / 100 });
    }
  }
  return map;
}

/**
 * @param {ReturnType<typeof buildBankCategoryMap>} map
 * @param {string} label - Categoria della banca della riga nuova.
 * @param {'expense'|'income'} type
 * @returns {{ categoryId: string, subCategory1Id: string|null, support: number, agreement: number } | null}
 */
export function lookupBankCategory(map, label, type) {
  const norm = normalizeBankCategory(label);
  return norm ? map.get(`${type === 'income' ? 'income' : 'expense'}|${norm}`) ?? null : null;
}
