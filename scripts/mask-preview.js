/**
 * Mostra come il mascheramento trasforma un estratto conto, riga per riga, senza inviare nulla
 * e senza caricarlo nell'app. Serve a tarare lib/ai/mask.js sui propri file reali.
 *
 * Uso:
 *   node scripts/mask-preview.js <file.csv|file.xlsx> [--description B] [--payee C]
 *                                [--skip N] [--delimiter ";"] [--all]
 *
 * Con --description e --payee (lettere delle colonne, come nei template di import) ogni riga è
 * mascherata esattamente come nell'app, compresa la regola sulla colonna dell'esercente nei
 * trasferimenti. Senza, le celle non numeriche diventano un solo testo: va bene per una prima
 * occhiata, ma quella regola non si applica.
 *
 * Senza --all mostra solo le righe che il mascheramento cambia, più i trasferimenti dove non è
 * stato mascherato nessun nome e la controparte non ha l'aria di un'attività: sono i casi da
 * guardare.
 *
 * Esempio:
 *   node scripts/mask-preview.js ~/Scaricati/estratto-ottobre.csv --description B --payee C --skip 1
 */

import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import { looksLikeBusiness, maskRow } from '../lib/ai/mask.js';
import { colToIndex } from '../lib/utils/importParser.js';

/** Argomenti: il file, e le opzioni con il loro valore subito dopo. */
const options = { '--skip': '0', '--delimiter': ';', '--description': null, '--payee': null };
let file = null;
let showAll = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--all') showAll = true;
  else if (argv[i] in options) options[argv[i]] = argv[++i];
  else file = argv[i];
}
if (!file) {
  console.error('Uso: node scripts/mask-preview.js <file.csv|file.xlsx> [--description B] [--payee C] [--skip N] [--delimiter ";"] [--all]');
  process.exit(1);
}
const skip = Number(options['--skip']) || 0;

const buffer = readFileSync(file);
const isCsv = /\.csv$/i.test(file);
const wb = isCsv
  ? XLSX.read(buffer.toString('utf8'), { type: 'string', raw: true, FS: options['--delimiter'] })
  : XLSX.read(buffer, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }).slice(skip);

/** Una cella è testo da mascherare se non è un numero, un importo o una data. */
const isText = (v) => {
  const s = String(v).trim();
  return s && !/^[-+]?[\d.,]+$/.test(s) && !/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(s);
};

const descCol = options['--description'] ? colToIndex(options['--description']) : -1;
const payeeCol = options['--payee'] ? colToIndex(options['--payee']) : -1;
const byColumns = descCol >= 0 || payeeCol >= 0;
if (!byColumns) console.log('Senza --description/--payee: le celle sono unite in un solo testo (vedi l\'intestazione dello script).\n');

const stats = { rows: 0, changed: 0, transfers: 0, placeholders: {} };
for (const [i, row] of rows.entries()) {
  const cell = (c) => (c >= 0 ? String(row[c] ?? '').trim() : '');
  const input = byColumns
    ? { description: cell(descCol), payee: cell(payeeCol) }
    : { description: row.filter(isText).map((c) => String(c).trim()).join(' | '), payee: '' };
  const text = [input.description, input.payee].filter(Boolean).join(' | ');
  if (!text) continue;
  stats.rows += 1;
  const m = maskRow(input);
  const sent = [m.description, m.payee].filter(Boolean).join(' | ');
  const changed = sent !== text;
  if (changed) stats.changed += 1;
  if (m.transfer) stats.transfers += 1;
  for (const p of sent.match(/\[[A-Z]+\]/g) ?? []) stats.placeholders[p] = (stats.placeholders[p] ?? 0) + 1;
  // Trasferimento senza nomi mascherati e senza l'aria di un'attività: forse una persona è passata.
  const suspicious = m.transfer && !sent.includes('[NOME]') && !looksLikeBusiness(sent);
  if (showAll || changed || suspicious) {
    const mark = suspicious ? '⚠ ' : changed ? '✓ ' : '  ';
    console.log(`${mark}${String(i + skip + 1).padStart(5)}  ${text}`);
    console.log(`         → ${sent}`);
  }
}

console.log('\nRighe:', stats.rows, '· cambiate:', stats.changed, '· trasferimenti:', stats.transfers);
console.log('Segnaposto:', Object.entries(stats.placeholders).map(([k, v]) => `${k} ${v}`).join(', ') || 'nessuno');
console.log('⚠ = trasferimento senza nomi mascherati né parole da attività: controlla che non contenga una persona.');
