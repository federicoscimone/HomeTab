/**
 * Scarica da ISTAT la spesa media mensile delle famiglie e scrive l'istantanea che l'app usa per
 * il confronto con le famiglie simili: data/istat/spese-famiglie.js, da versionare nel repo.
 *
 * L'app non chiama mai ISTAT: l'indagine esce una volta l'anno (a ottobre), il servizio accetta 5
 * richieste al minuto per IP e blocca per 1-2 giorni chi le supera, e un numero citato deve restare
 * riproducibile. Questo script fa una sola richiesta; si lancia quando esce l'indagine nuova, si
 * guarda il diff e si committa.
 *
 * Fonte: Istat, Indagine sulle spese delle famiglie (dataflow 31_740, tavola per numero di
 * componenti, classificazione COICOP 2018). Licenza Creative Commons Attribuzione 4.0.
 *
 * Uso:
 *   node scripts/istat-sync.js [--year 2025]
 *
 * Senza --year prende l'anno più recente pubblicato.
 */

import { writeFileSync } from 'fs';
import { DIVISIONS } from '../lib/utils/coicop.js';

const DATAFLOW = '31_740_DF_DCCV_SPEMEFAM_COICOP_2018_3';
const BASE = 'https://esploradati.istat.it/SDMXWS/rest/data';
const OUT = new URL('../data/istat/spese-famiglie.js', import.meta.url);

// Dimensioni della tavola, nell'ordine della chiave SDMX: frequenza, territorio, tipo di dato,
// capitolo, categoria, quinto di spesa, comportamento d'acquisto, componenti, tipologia, titolo di
// studio, condizione professionale. Il punto lascia libera una dimensione (tutti i territori).
const CODES = [...DIVISIONS, '042', 'ALL'];
const SIZES = ['N1', 'N2', 'N3', 'N4', 'N5_GE', 'TOT'];
const KEY = ['A', '', 'SPESA_MEDIA', CODES.join('+'), 'ALL', 'ALL', 'ALL', SIZES.join('+'), 'HH', '99', 'ALL'].join('.');

const yearArg = process.argv.includes('--year') ? Number(process.argv[process.argv.indexOf('--year') + 1]) : null;
const startPeriod = yearArg ?? new Date().getFullYear() - 2;

/** CSV SDMX: virgole come separatore, virgolette solo attorno ai campi che le richiedono. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.length > 1);
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const url = `${BASE}/IT1,${DATAFLOW},1.0/${KEY}?startPeriod=${startPeriod}${yearArg ? `&endPeriod=${yearArg}` : ''}`;
console.log(`Richiesta a ISTAT: ${url}`);
// Accept-Language esplicito: il fetch di Node manda «*», e con quello il servizio risponde 500.
const headers = { Accept: 'application/vnd.sdmx.data+csv;version=1.0.0', 'Accept-Language': 'it' };
// Un 5xx a volte è passeggero: un secondo tentativo, 15 secondi dopo, resta dentro il limite.
let res = await fetch(url, { headers });
if (res.status >= 500) {
  console.log(`ISTAT ha risposto ${res.status}: riprovo fra 15 secondi.`);
  await new Promise((r) => { setTimeout(r, 15_000); });
  res = await fetch(url, { headers });
}
if (!res.ok) {
  console.error(`ISTAT ha risposto ${res.status}. Con 429 o 403 il limite di richieste è stato superato: riprova domani.`);
  process.exit(1);
}
const records = parseCsv(await res.text());
const years = [...new Set(records.filter((r) => r.OBS_VALUE !== '').map((r) => Number(r.TIME_PERIOD)))].sort();
const year = yearArg ?? years.at(-1);
if (!year || !years.includes(year)) {
  console.error(`Nessun dato per ${yearArg ?? 'gli anni richiesti'}. Anni presenti: ${years.join(', ') || 'nessuno'}.`);
  process.exit(1);
}

// territorio → componenti → capitolo → euro al mese. Un valore non pubblicato (campione troppo
// piccolo, OBS_STATUS 0) resta null: l'app ripiega su un territorio più ampio.
const values = {};
for (const r of records) {
  if (Number(r.TIME_PERIOD) !== year) continue;
  const area = (values[r.REF_AREA] ??= {});
  const size = (area[r.NUMBER_HOUSEHOLD_COMP] ??= {});
  size[r.COICOP_2018] = r.OBS_VALUE === '' ? null : Number(r.OBS_VALUE);
}

const areas = Object.keys(values).sort();
const lines = areas.map((area) => {
  const sizes = SIZES.filter((s) => values[area][s]).map((s) => {
    const cells = CODES.filter((c) => c in values[area][s]).map((c) => `'${c}': ${values[area][s][c]}`);
    return `    ${s}: { ${cells.join(', ')} },`;
  });
  return `  ${area}: {\n${sizes.join('\n')}\n  },`;
});

const today = new Date().toISOString().slice(0, 10);
writeFileSync(OUT, `/**
 * Spesa media mensile delle famiglie per territorio, numero di componenti e capitolo COICOP 2018.
 * Generato da scripts/istat-sync.js il ${today}: non modificare a mano.
 *
 * Fonte: Istat, Indagine sulle spese delle famiglie, anno ${year} (dataflow ${DATAFLOW}).
 * Licenza Creative Commons Attribuzione 4.0 (https://creativecommons.org/licenses/by/4.0/).
 * Valori in euro al mese; null = non pubblicato da ISTAT. '042' sono gli affitti figurativi.
 */

const values = {
${lines.join('\n')}
};

const snapshot = { year: ${year}, dataflow: '${DATAFLOW}', downloadedAt: '${today}', values };

export default snapshot;
`);
const published = records.filter((r) => Number(r.TIME_PERIOD) === year && r.OBS_VALUE !== '').length;
console.log(`Scritto data/istat/spese-famiglie.js: anno ${year}, ${areas.length} territori, ${published} valori pubblicati.`);
