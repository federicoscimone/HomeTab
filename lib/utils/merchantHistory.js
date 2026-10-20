/**
 * @fileoverview Riconoscimento di un esercente nello storico dei movimenti già categorizzati.
 * @module lib/utils/merchantHistory
 *
 * Molti esercenti hanno nomi che non dicono nulla («LA BOTTEGA DI SARA», «SUMUP *GIO 2»): né una
 * parola chiave né un modello possono indovinarli, ma la famiglia li ha già categorizzati in
 * passato. Qui si cercano nello storico, **in locale**: nulla esce dal server.
 *
 * Come si confrontano due testi:
 * - si riducono alle parole significative: via i prefissi dei circuiti di pagamento («SUMUP *»,
 *   «SQ *», «PAYPAL *»), le parole di servizio delle banche («PAGAMENTO», «POS», «CARTA»…), le
 *   cifre e i segnaposto;
 * - ogni parola pesa quanto è rara nello storico (IDF): «ESSELUNGA» compare in pochi esercenti e
 *   vale molto, «MILANO» in tanti e vale poco;
 * - il punteggio è la parte pesata delle parole in comune rispetto al testo più corto: 1 vuol dire
 *   che uno dei due contiene tutte le parole significative dell'altro.
 *
 * Una categoria si applica da sola solo se il riconoscimento è pieno e lo storico è concorde; gli
 * altri casi diventano esempi mirati per il modello.
 */

/** Prefissi dei circuiti: davanti all'asterisco c'è il circuito, dopo l'esercente vero. */
const PROCESSOR_RE = /\b(?:SUMUP|SUM\s?UP|ZETTLE|IZETTLE|SQ|SQUARE|PAYPAL|STRIPE|ADYEN|NEXI|SATISPAY|SMP|SPC|GOOGLE|APPLE|AMZN|AMAZON\s+MKTP?)\s*\*\s*/gi;

const STOP = new Set([
  'PAGAMENTO', 'PAGAM', 'PAG', 'POS', 'CARTA', 'CARD', 'ADDEBITO', 'ACCREDITO', 'SDD', 'SEPA', 'DIRECT',
  'DEBIT', 'BONIFICO', 'ACQUISTO', 'ACQ', 'OPERAZIONE', 'OPER', 'PRESSO', 'DEL', 'DELLA', 'DELLE', 'DEI',
  'DEGLI', 'DI', 'DA', 'IN', 'IL', 'LA', 'LE', 'LO', 'GLI', 'AL', 'ALLA', 'ED', 'PER', 'CON', 'SUL',
  'VIA', 'VIALE', 'PIAZZA', 'PZA', 'CORSO', 'LARGO', 'SPA', 'SRL', 'SRLS', 'SNC', 'SAS', 'NUM', 'NOME',
  'IBAN', 'EMAIL', 'ORE', 'CONTACTLESS', 'ONLINE', 'INTERNET', 'WEB', 'EUR', 'EURO', 'ITA', 'ITALIA',
  'THE', 'AND', 'COM', 'WWW', 'APP', 'PAY', 'SHOP', 'STORE', 'NFC', 'MAESTRO', 'VISA', 'MASTERCARD',
  'BANCOMAT', 'PAGOBANCOMAT', 'DEBITO', 'CREDITO', 'PREPAGATA', 'SATISPAY', 'PAYPAL', 'SUMUP',
]);

/**
 * @param {string|null|undefined} text
 * @returns {string[]} Le parole significative, in maiuscolo e senza ripetizioni.
 */
export function merchantTokens(text) {
  const clean = String(text || '')
    .toUpperCase()
    .replace(PROCESSOR_RE, ' ')
    .replace(/\[[A-Z]+\]/g, ' ')
    .replace(/[^\p{L}]+/gu, ' ');
  const out = [];
  for (const w of clean.split(' ')) {
    if (w.length >= 3 && !STOP.has(w) && !out.includes(w)) out.push(w);
  }
  return out;
}

/** Il testo con cui un movimento passato rappresenta il suo esercente. */
export const historyText = (m) => (m.payee?.trim() ? m.payee : m.description) || '';

/**
 * @typedef {Object} HistoryEntry
 * @property {string} text           - Esercente (o causale) del movimento passato.
 * @property {string} categoryId
 * @property {string|null} subCategory1Id
 * @property {'expense'|'income'} [type] - Uscita o entrata.
 * @property {number} count          - Quanti movimenti con quel testo e quella categoria.
 * @property {string} [sendText]     - Lo stesso testo mascherato, l'unico che può lasciare il server.
 */

/**
 * @param {HistoryEntry[]} entries
 * @returns {{ entries: (HistoryEntry & { tokens: string[] })[], idf: (t: string) => number }}
 */
export function buildHistoryIndex(entries) {
  const indexed = entries
    .map((e) => ({ ...e, tokens: merchantTokens(e.text) }))
    .filter((e) => e.tokens.length > 0);
  const df = new Map();
  for (const e of indexed) for (const t of e.tokens) df.set(t, (df.get(t) ?? 0) + 1);
  const n = indexed.length;
  const idf = (t) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1;
  return { entries: indexed, idf };
}

/** Punteggio fra le parole di una riga e quelle di un movimento passato (0…1). */
function score(rowTokens, entryTokens, idf) {
  const weight = (ts) => ts.reduce((s, t) => s + idf(t), 0);
  const shared = entryTokens.filter((t) => rowTokens.includes(t));
  if (shared.length === 0) return { score: 0, sharedWeight: 0 };
  const sharedWeight = weight(shared);
  return { score: sharedWeight / Math.min(weight(rowTokens), weight(entryTokens)), sharedWeight };
}

/** Riconoscimento pieno: uno dei due testi contiene tutte le parole significative dell'altro. */
export const AUTO_SCORE = 0.99;
/** Almeno una parola non banale in comune: una sola parola comunissima non basta. */
export const MIN_SHARED_WEIGHT = 2.5;
/** Quota dei movimenti riconosciuti che deve stare nella stessa categoria. */
export const MIN_AGREEMENT = 0.8;
/** Sotto questo punteggio un movimento passato non è nemmeno un esempio utile. */
export const SIMILAR_SCORE = 0.3;

/**
 * Cerca l'esercente di una riga nello storico.
 *
 * @param {ReturnType<typeof buildHistoryIndex>} index
 * @param {string} rowText - Causale, esercente e luogo della riga nuova, insieme.
 * @param {'expense'|'income'} [type] - Si confronta solo con i movimenti dello stesso tipo:
 *   un'uscita da «AZIENDA AGRICOLA» non è lo stipendio pagato da «Azienda».
 * @returns {{ match: { categoryId: string, subCategory1Id: string|null, support: number, text: string } | null,
 *   similar: { text: string, categoryId: string, subCategory1Id: string|null, score: number }[] }}
 *   `match`: categoria da applicare da sola (riconoscimento pieno e storico concorde).
 *   `similar`: i movimenti passati più somiglianti, come esempi per il modello (al massimo 3);
 *   verso il modello va solo il loro `sendText`.
 */
export function lookupMerchant(index, rowText, type = null) {
  const rowTokens = merchantTokens(rowText);
  if (rowTokens.length === 0) return { match: null, similar: [] };
  const scored = [];
  for (const e of index.entries) {
    if (type && e.type && e.type !== type) continue;
    const s = score(rowTokens, e.tokens, index.idf);
    if (s.score >= SIMILAR_SCORE && s.sharedWeight >= MIN_SHARED_WEIGHT) scored.push({ ...e, ...s });
  }
  scored.sort((a, b) => b.score - a.score || b.sharedWeight - a.sharedWeight || b.count - a.count);

  let match = null;
  const full = scored.filter((e) => e.score >= AUTO_SCORE);
  if (full.length) {
    // Tutti i movimenti passati riconosciuti votano, ciascuno con il suo numero di movimenti.
    const votes = new Map();
    for (const e of full) {
      const key = `${e.categoryId}/${e.subCategory1Id ?? ''}`;
      votes.set(key, (votes.get(key) ?? 0) + e.count);
    }
    const total = [...votes.values()].reduce((a, b) => a + b, 0);
    const [bestKey, bestVotes] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bestVotes / total >= MIN_AGREEMENT) {
      const best = full.find((e) => `${e.categoryId}/${e.subCategory1Id ?? ''}` === bestKey);
      match = { categoryId: best.categoryId, subCategory1Id: best.subCategory1Id, support: bestVotes, text: best.text };
    }
  }

  // Esempi per il modello: un solo movimento per categoria, i più somiglianti.
  const similar = [];
  const seenCat = new Set();
  for (const e of scored) {
    const key = `${e.categoryId}/${e.subCategory1Id ?? ''}`;
    if (seenCat.has(key)) continue;
    seenCat.add(key);
    similar.push({
      text: e.text, sendText: e.sendText ?? null, categoryId: e.categoryId, subCategory1Id: e.subCategory1Id,
      score: Math.round(e.score * 100) / 100,
    });
    if (similar.length >= 3) break;
  }
  return { match, similar };
}
