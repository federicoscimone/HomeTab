/**
 * Script di importazione: "export analisi banca.xlsx" → MongoDB HomeBI
 *
 * Fogli:
 *   "Dati"        – movimenti bancari principali (4390 righe)
 *   "Dati Ticket" – utilizzi buoni pasto (39 righe)
 *   "Categorie"   – elenco categorie e sotto-categorie del file
 *
 * Uso:
 *   node scripts/import-banca.js [--dry-run]
 *
 * Le categorie nel file sono in MAIUSCOLO; quelle nel DB sono in Title Case.
 * Il confronto avviene in modo case-insensitive; le nuove categorie vengono
 * create in Title Case (es. "MANUTENZIONE CASA" → "Manutenzione Casa").
 */

import XLSX from 'xlsx';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN      = process.argv.includes('--dry-run');
const EXCEL_FILE   = path.resolve('export analisi banca.xlsx');
const BATCH_ID     = randomUUID();
const IMPORT_DATE  = new Date().toISOString();

// Legge MONGODB_URI da .env.local se non è già nell'ambiente
let MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  try {
    const env = readFileSync('.env.local', 'utf8');
    const match = env.match(/^MONGODB_URI=(.+)$/m);
    if (match) MONGODB_URI = match[1].trim();
  } catch {/* ignora */}
}
if (!MONGODB_URI) {
  console.error('MONGODB_URI non trovata. Imposta la variabile d\'ambiente o crea .env.local');
  process.exit(1);
}

// ── Mongoose schemas (inline, no imports dal progetto) ────────────────────────

const CategorySchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  color:    { type: String, default: '#6366f1' },
  icon:     { type: String, default: 'tag' },
  level:    { type: Number, enum: [1, 2, 3], default: 1 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  order:    { type: Number, default: 0 },
}, { timestamps: true });

const ExpenseSchema = new mongoose.Schema({
  amount:              { type: Number, required: true },
  paymentMethod:       { type: String, required: true },
  paymentGroup:        { type: String, required: true },
  date:                { type: String, required: true },
  time:                { type: String, default: null },
  description:         { type: String, default: '', maxlength: 500 },
  place:               { type: String, default: '' },
  payee:               { type: String, default: '' },
  notes:               { type: String, default: '' },
  categoryId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  subCategory1Id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  subCategory2Id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  type:                { type: String, enum: ['expense', 'income'], default: 'expense' },
  source:              { type: String, default: 'import' },
  importMethod:        { type: String, default: 'xlsx' },
  importBatchId:       { type: String, default: null },
  excludeFromAnalysis: { type: Boolean, default: false },
}, { timestamps: true });

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Expense   = mongoose.models.Expense  || mongoose.model('Expense',  ExpenseSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converte un numero seriale Excel in stringa YYYY-MM-DD. */
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  // Excel bug: considera il 1900 anno bisestile (giorno 60 = 29/02/1900 inesistente)
  const adj = serial > 59 ? serial - 1 : serial;
  const d   = new Date(Math.round((adj - 25568) * 86400 * 1000));
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Title Case: "MANUTENZIONE CASA" → "Manutenzione Casa". */
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Mappa TIPO e LUOGO al paymentMethod dell'app.
 * Molte righe hanno TIPO vuoto: in quel caso il tipo si ricava dal prefisso di LUOGO.
 * Per il foglio Ticket usa sempre 'meal_ticket'.
 */
function mapPaymentMethod(tipo, luogo = '', isTicket = false) {
  if (isTicket) return 'meal_ticket';

  // Usa TIPO se valorizzato, altrimenti cade sul prefisso di LUOGO
  const raw = ((tipo || '').trim() || (luogo || '').trim()).toLowerCase();

  if (['pagam. pos', 'bnz', 'pos'].some(k => raw.startsWith(k)))         return 'debit_card';
  if (['carta di credito'].some(k => raw.startsWith(k)))                  return 'credit_card';
  if (['bancomat', 'atm', 'contanti', 'prelievo', 'vers. cont.'].some(k => raw.startsWith(k))) return 'cash';
  if (['bonif.', 'disposizione', 'addebito', 'pagamento cbill', 'delega',
       'rimb.', 'bollettino', 'da ing', 'inter.', 'stipendio',
       'ricarica'].some(k => raw.startsWith(k)))                           return 'bank_transfer';
  return 'other';
}

/** Restituisce il payment group dato il payment method. */
function paymentGroup(method) {
  return ['meal_ticket', 'gift_voucher', 'fuel_voucher', 'other_voucher'].includes(method)
    ? 'alternative'
    : 'traditional';
}

// ── Lettura Excel ─────────────────────────────────────────────────────────────

console.log(`\n📂 Lettura file: ${EXCEL_FILE}`);
const wb    = XLSX.readFile(EXCEL_FILE);
const dati  = XLSX.utils.sheet_to_json(wb.Sheets['Dati'],        { defval: '' });
const ticket = XLSX.utils.sheet_to_json(wb.Sheets['Dati Ticket'], { defval: '' });
const catSheet = XLSX.utils.sheet_to_json(wb.Sheets['Categorie'], { defval: '' });

console.log(`  Dati:         ${dati.length} righe`);
console.log(`  Dati Ticket:  ${ticket.length} righe`);
console.log(`  Categorie:    ${catSheet.length} righe`);

// ── Raccolta categorie/sub-categorie dal file ──────────────────────────────────

// Struttura: Map<catUppercase, Set<subUppercase>>
const catMap = new Map();

// Dal foglio Categorie
for (const row of catSheet) {
  const cat = (row['CATEGORIE'] || '').trim().toUpperCase();
  const sub = (row['SUB-CATEGORIE'] || '').trim().toUpperCase();
  if (cat) {
    if (!catMap.has(cat)) catMap.set(cat, new Set());
  }
  // Le sub-categorie nel foglio Categorie non hanno una mappatura esplicita
  // al genitore: le leggiamo solo per crearle come categorie standalone se
  // compaiono anche nei dati (vengono gestite sotto).
}

// Dalle righe di dati: accoppiamo categoria → sub-categoria reali
for (const row of [...dati, ...ticket]) {
  const cat = (row['CATEGORIA'] || '').trim().toUpperCase();
  const sub = (row['SUB-CATEGORIA'] || '').trim().toUpperCase();
  if (cat) {
    if (!catMap.has(cat)) catMap.set(cat, new Set());
    if (sub) catMap.get(cat).add(sub);
  }
}

console.log(`\n🏷️  Categorie trovate nel file: ${catMap.size}`);
for (const [cat, subs] of catMap) {
  if (subs.size) console.log(`   ${cat} → ${[...subs].join(', ')}`);
}

// ── Connessione DB ────────────────────────────────────────────────────────────

console.log('\n🔌 Connessione a MongoDB…');
await mongoose.connect(MONGODB_URI);
console.log('   Connesso.');

// ── Gestione categorie ────────────────────────────────────────────────────────

// Carica tutte le categorie esistenti
const existingCats = await Category.find({}).lean();

// Lookup case-insensitive: key = nome.toLowerCase(), value = doc
const catByNameLower = new Map();
for (const c of existingCats) {
  catByNameLower.set(c.name.toLowerCase(), c);
}

/** Trova o crea una categoria.
 *  @param {string} nameUpper  – nome in MAIUSCOLO (dal file)
 *  @param {number} level      – 1 | 2
 *  @param {ObjectId|null} parentId
 *  @returns {ObjectId}
 */
async function findOrCreateCategory(nameUpper, level, parentId = null) {
  const nameLower = nameUpper.trim().toLowerCase();
  const nameTitle = toTitleCase(nameUpper.trim());

  // Prima cerca tra quelle già in memoria (incluse quelle appena create)
  if (catByNameLower.has(nameLower)) {
    return catByNameLower.get(nameLower)._id;
  }

  // Non esiste: crea
  console.log(`   ➕ Nuova categoria (level ${level}): "${nameTitle}"${parentId ? ` (parent: ${parentId})` : ''}`);
  if (DRY_RUN) {
    // In dry-run restituisce un ObjectId fittizio stabile
    const fakeId = new mongoose.Types.ObjectId();
    catByNameLower.set(nameLower, { _id: fakeId, name: nameTitle, level, parentId });
    return fakeId;
  }
  const doc = await Category.create({ name: nameTitle, level, parentId, color: '#6366f1', icon: 'tag', order: 0 });
  catByNameLower.set(nameLower, doc);
  return doc._id;
}

// Crea tutte le categorie e sotto-categorie dal file
console.log('\n🏗️  Verifica/creazione categorie…');
const catIdByUpper    = new Map(); // "SPESA" → ObjectId
const subCatIdByUpper = new Map(); // "SPESA::ACQUA" → ObjectId

for (const [catUpper, subs] of catMap) {
  const catId = await findOrCreateCategory(catUpper, 1, null);
  catIdByUpper.set(catUpper, catId);

  for (const subUpper of subs) {
    const subId = await findOrCreateCategory(subUpper, 2, catId);
    subCatIdByUpper.set(`${catUpper}::${subUpper}`, subId);
  }
}

// ── Costruzione documenti spesa ───────────────────────────────────────────────

console.log('\n📝 Costruzione movimenti…');

function buildExpense(row, isTicket = false) {
  const dateISO = excelDateToISO(row['DATA']);
  if (!dateISO) return null;

  const entrate = parseFloat(row['ENTRATE']) || 0;
  const uscite  = parseFloat(row['USCITE'])  || 0;

  // Almeno uno dei due deve essere valorizzato
  if (entrate === 0 && uscite === 0) return null;

  const isIncome = entrate !== 0;
  const amount   = isIncome ? entrate : Math.abs(uscite);
  if (amount <= 0) return null;

  const tipo    = isTicket ? 'TICKET' : (row['TIPO'] || '');
  const method  = mapPaymentMethod(tipo, row['LUOGO'] || '', isTicket);
  const group   = paymentGroup(method);

  const catUpper = (row['CATEGORIA'] || '').trim().toUpperCase();
  const subUpper = (row['SUB-CATEGORIA'] || '').trim().toUpperCase();

  const categoryId   = catUpper ? catIdByUpper.get(catUpper) ?? null : null;
  const subCat1Id    = (catUpper && subUpper)
    ? subCatIdByUpper.get(`${catUpper}::${subUpper}`) ?? null
    : null;

  // Per i ticket: payee = ALTRO (negozio), description = LUOGO
  // Per i normali: description = LUOGO (causale bancaria)
  const description = (row['LUOGO'] || '').trim().slice(0, 500);
  const payee       = isTicket ? (row['ALTRO'] || '').trim().slice(0, 200) : '';
  const notes       = (row['NOTE'] || '').trim().slice(0, 1000);

  return {
    amount,
    paymentMethod:  method,
    paymentGroup:   group,
    date:           dateISO,
    time:           null,
    description,
    place:          '',
    payee,
    notes,
    categoryId,
    subCategory1Id: subCat1Id,
    subCategory2Id: null,
    type:           isIncome ? 'income' : 'expense',
    source:         'import',
    importMethod:   'xlsx',
    importBatchId:  BATCH_ID,
    excludeFromAnalysis: false,
  };
}

const docs = [];

for (const row of dati) {
  const doc = buildExpense(row, false);
  if (doc) docs.push(doc);
}
for (const row of ticket) {
  const doc = buildExpense(row, true);
  if (doc) docs.push(doc);
}

console.log(`   Movimenti validi: ${docs.length} (su ${dati.length + ticket.length} righe totali)`);

// ── Inserimento ───────────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log('\n⚠️  DRY RUN – nessun dato salvato.');
  console.log(`   Verrebbero inseriti ${docs.length} movimenti con batch ID: ${BATCH_ID}`);
  // Stampa un esempio
  console.log('\n   Esempio primo documento:');
  console.log(JSON.stringify(docs[0], null, 2));
} else {
  console.log('\n💾 Inserimento in corso…');
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    await Expense.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
    inserted += Math.min(CHUNK, docs.length - i);
    process.stdout.write(`\r   ${inserted}/${docs.length} inseriti…`);
  }
  console.log(`\n   ✅ Importazione completata. Batch ID: ${BATCH_ID}`);
}

await mongoose.disconnect();
console.log('\n🔌 Disconnesso. Fine.\n');
