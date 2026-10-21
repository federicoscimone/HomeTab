/**
 * @fileoverview Il dato ISTAT di riferimento per il profilo della famiglia.
 * @module lib/utils/istat
 *
 * L'istantanea (data/istat/spese-famiglie.js, scritta da scripts/istat-sync.js) contiene la spesa
 * media mensile per territorio × numero di componenti × capitolo. Queste funzioni scelgono il
 * valore più vicino al profilo:
 * - regione e numero di componenti; dove ISTAT non lo pubblica (campione troppo piccolo) si
 *   ripiega sulla ripartizione, poi sull'Italia, sempre con lo stesso numero di componenti;
 * - casa (capitolo 04) senza gli affitti figurativi, cioè l'affitto stimato anche per chi vive in
 *   casa propria. ISTAT li pubblica (042) solo per l'Italia per componenti e per le ripartizioni in
 *   totale, quindi per regione e componenti la quota si stima con due fattori: quella della
 *   ripartizione, corretta per il numero di componenti con il rapporto nazionale.
 */

/** Regioni e province autonome, con la ripartizione in cui ISTAT le aggrega in questa tavola. */
export const REGIONS = {
  ITC1: 'ITCD', ITC2: 'ITCD', ITC3: 'ITCD', ITC4: 'ITCD',
  ITD1: 'ITCD', ITD2: 'ITCD', ITD3: 'ITCD', ITD4: 'ITCD', ITD5: 'ITCD',
  ITE1: 'ITE', ITE2: 'ITE', ITE3: 'ITE', ITE4: 'ITE',
  ITF1: 'ITFG', ITF2: 'ITFG', ITF3: 'ITFG', ITF4: 'ITFG', ITF5: 'ITFG', ITF6: 'ITFG',
  ITG1: 'ITFG', ITG2: 'ITFG',
};

export const MAX_MEMBERS = 5;

/** Classe ISTAT del numero di componenti: 5 vale «5 o più». */
export const sizeKey = (members) => (members ? (members >= MAX_MEMBERS ? 'N5_GE' : `N${members}`) : 'TOT');

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Quota degli affitti figurativi sul capitolo casa, per ripartizione e componenti.
 * @returns {{ share: number, estimated: boolean }|null}
 */
function imputedShare(values, macro, size) {
  const share = (area, s) => {
    const all = num(values[area]?.[s]?.['04']);
    const imputed = num(values[area]?.[s]?.['042']);
    return all && imputed != null ? imputed / all : null;
  };
  const direct = share(macro, size);
  if (direct != null) return { share: direct, estimated: false };
  const macroTot = share(macro, 'TOT');
  const itSize = share('IT', size);
  const itTot = share('IT', 'TOT');
  if (macroTot != null && itSize != null && itTot) return { share: macroTot * (itSize / itTot), estimated: true };
  return itSize != null ? { share: itSize, estimated: true } : null;
}

/**
 * @param {{ values: object }} snapshot
 * @param {{ region?: string|null, members?: number|null }} profile
 * @param {string[]} codes - Capitoli richiesti, più 'ALL' per il totale.
 * @returns {Record<string, { value: number|null, area: string|null, estimated: boolean }>}
 *   Per capitolo: l'importo mensile, il territorio da cui viene e se è una stima (solo casa e
 *   totale, per gli affitti figurativi).
 */
export function istatReference(snapshot, { region = null, members = null } = {}, codes) {
  const { values } = snapshot;
  const size = sizeKey(members);
  const macro = REGIONS[region] ?? null;
  const areas = [region, macro, 'IT'].filter((a, i, all) => a && all.indexOf(a) === i);

  const pick = (code) => {
    for (const area of areas) {
      const v = num(values[area]?.[size]?.[code]);
      if (v != null) return { value: v, area };
    }
    return { value: null, area: null };
  };

  const out = {};
  for (const code of codes) {
    const found = pick(code);
    if (found.value == null || (code !== '04' && code !== 'ALL')) {
      out[code] = { ...found, estimated: false };
      continue;
    }
    // Casa e totale senza affitti figurativi: in valore assoluto dove ISTAT li pubblica allo
    // stesso livello, altrimenti con la quota stimata applicata al capitolo casa.
    const imputedHere = num(values[found.area]?.[size]?.['042']);
    let imputed = imputedHere;
    let estimated = false;
    if (imputed == null) {
      const housing = num(values[found.area]?.[size]?.['04']);
      const ratio = imputedShare(values, REGIONS[found.area] ?? found.area, size);
      imputed = housing != null && ratio ? housing * ratio.share : null;
      estimated = true;
    }
    out[code] = imputed == null
      ? { value: null, area: null, estimated: false }
      : { value: Math.round((found.value - imputed) * 100) / 100, area: found.area, estimated };
  }
  return out;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Gli ultimi 12 mesi completi: il mese in corso no, la media mensile ne uscirebbe falsata. Se i
 * movimenti cominciano dopo, i mesi si contano da lì, perché un mese senza dati non è un mese a zero.
 *
 * @param {Date} now
 * @param {string|null} firstDate - Data (YYYY-MM-DD) della prima uscita registrata.
 * @returns {{ from: string, to: string, months: number }}
 */
export function comparisonWindow(now = new Date(), firstDate = null) {
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // ultimo giorno del mese scorso
  let start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  if (firstDate) {
    const first = new Date(Number(firstDate.slice(0, 4)), Number(firstDate.slice(5, 7)) - 1, 1);
    if (first > start) start = first;
  }
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(start), to: fmt(end), months: Math.max(months, 0) };
}

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Le spese della famiglia per capitolo, in media mensile, accanto al riferimento ISTAT.
 *
 * @param {Object} args
 * @param {{ _id: { c?: any, s1?: any, s2?: any }, total: number }[]} args.groups - Uscite sommate
 *   per categoria e sottocategorie.
 * @param {Map<string, { name: string, level: number, coicop?: string|null }>} args.byId
 * @param {number} args.months
 * @param {ReturnType<typeof istatReference>} args.reference
 * @param {(ids: { c?: any, s1?: any, s2?: any }) => string|null} args.divisionOf - Capitolo di un gruppo.
 * @param {string[]} args.divisions
 */
export function compareWithIstat({ groups, byId, months, reference, divisionOf, divisions }) {
  const perDivision = Object.fromEntries(divisions.map((d) => [d, 0]));
  const unmapped = new Map(); // categoria di primo livello → totale
  let uncategorized = 0;
  let total = 0;
  for (const g of groups) {
    total += g.total;
    if (!g._id.c) { uncategorized += g.total; continue; }
    const code = divisionOf(g._id);
    if (code) perDivision[code] += g.total;
    else {
      const name = byId.get(String(g._id.c))?.name ?? '?';
      unmapped.set(name, (unmapped.get(name) ?? 0) + g.total);
    }
  }
  const monthly = (v) => (months > 0 ? round2(v / months) : null);
  const row = (yours, ref) => {
    const istat = ref?.value ?? null;
    return {
      yours,
      istat,
      diff: yours != null && istat != null ? round2(yours - istat) : null,
      pct: yours != null && istat ? round2(((yours - istat) / istat) * 100) : null,
      area: ref?.area ?? null,
      estimated: Boolean(ref?.estimated),
    };
  };
  return {
    rows: divisions.map((code) => ({ code, ...row(monthly(perDivision[code]), reference[code]) })),
    total: row(monthly(total), reference.ALL),
    unmapped: [...unmapped].map(([name, v]) => ({ name, monthly: monthly(v) })).sort((a, b) => b.monthly - a.monthly),
    uncategorized: monthly(uncategorized),
  };
}
