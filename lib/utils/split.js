/**
 * @fileoverview Divisione di un movimento in parti: importi, validazione e riconoscimento dei
 * duplicati.
 * @module lib/utils/split
 *
 * Un movimento diviso diventa più movimenti normali e indipendenti (ognuno con la sua categoria),
 * così report, budget e proiezioni non cambiano. Ogni parte ricorda il movimento originale nel
 * campo `split` ({ groupId, originalAmount, originalDescription, originalPayee }): serve a
 * riconoscerlo quando si reimporta lo stesso estratto conto, dove la banca riporta ancora la riga
 * intera.
 *
 * Gli importi si confrontano in centesimi interi: 0.1 + 0.2 in virgola mobile non fa 0.3.
 * Nessuna dipendenza da Mongoose, così si prova con node --test.
 */

/** @param {number} amount - Importo in euro. @returns {number} Centesimi interi. */
export const toCents = (amount) => Math.round(Number(amount) * 100);

/** @param {number} cents @returns {number} Euro. */
export const fromCents = (cents) => cents / 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEXT_MAX = { originalDescription: 500, originalPayee: 200 };

/**
 * L'importo che resta all'altra parte quando una delle due cambia.
 *
 * @param {number} total - Importo complessivo in euro.
 * @param {number} part - Importo scelto per una parte, in euro.
 * @returns {number|null} L'altra parte in euro, o null se la divisione non è valida (una parte
 *   a zero, negativa o maggiore del totale).
 *
 * @example
 * otherPart(100, 60) // 40
 * otherPart(0.3, 0.1) // 0.2
 * otherPart(100, 100) // null
 */
export function otherPart(total, part) {
  const t = toCents(total);
  const p = toCents(part);
  if (!Number.isFinite(t) || !Number.isFinite(p) || p <= 0 || p >= t) return null;
  return fromCents(t - p);
}

/**
 * Due metà di un importo; il centesimo dispari va alla prima.
 *
 * @example
 * halves(10.01) // [5.01, 5]
 */
export function halves(total) {
  const t = toCents(total);
  const second = Math.floor(t / 2);
  return [fromCents(t - second), fromCents(second)];
}

/**
 * Le informazioni sull'originale da salvare nelle parti, normalizzate. Se il movimento era già
 * una parte, l'originale resta quello del primo split: è la riga della banca.
 *
 * @param {{ amount: number, description?: string, payee?: string, split?: object|null }} movement
 * @param {string} groupId
 */
export function splitInfo(movement, groupId) {
  const prev = movement.split;
  if (prev?.groupId && prev.originalAmount > 0) {
    return {
      groupId: prev.groupId,
      originalAmount: prev.originalAmount,
      originalDescription: prev.originalDescription ?? '',
      originalPayee: prev.originalPayee ?? '',
    };
  }
  return {
    groupId,
    originalAmount: movement.amount,
    originalDescription: (movement.description ?? '').trim().slice(0, TEXT_MAX.originalDescription),
    originalPayee: (movement.payee ?? '').trim().slice(0, TEXT_MAX.originalPayee),
  };
}

/**
 * Valida le parti di un import: righe con lo stesso `split.groupId` devono essere almeno due,
 * dichiarare lo stesso originale e sommare al centesimo al suo importo.
 *
 * @param {{ amount: number, split?: { groupId: string, originalAmount: number } | null }[]} rows
 * @returns {string|null} Chiave di errore del namespace "errors", o null se va bene.
 */
export function validateSplitRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const s = row.split;
    if (s == null) continue;
    if (typeof s !== 'object' || typeof s.groupId !== 'string' || !UUID_RE.test(s.groupId)) return 'invalidSplit';
    if (!(Number(s.originalAmount) > 0)) return 'invalidSplit';
    if (!(Number(row.amount) > 0)) return 'invalidSplit';
    for (const [field, max] of Object.entries(TEXT_MAX)) {
      if (s[field] != null && (typeof s[field] !== 'string' || s[field].length > max)) return 'invalidSplit';
    }
    if (!groups.has(s.groupId)) groups.set(s.groupId, []);
    groups.get(s.groupId).push(row);
  }
  for (const parts of groups.values()) {
    if (parts.length < 2) return 'invalidSplit';
    const original = toCents(parts[0].split.originalAmount);
    if (parts.some((p) => toCents(p.split.originalAmount) !== original)) return 'invalidSplit';
    if (parts.reduce((sum, p) => sum + toCents(p.amount), 0) !== original) return 'splitSumMismatch';
  }
  return null;
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * La riga importata è già nel database come `movement`? Stessa data, stesso importo e almeno un
 * testo (descrizione o esercente) uguale. Un movimento diviso si riconosce dal suo originale:
 * la banca riporta la riga intera, non le parti.
 *
 * @param {{ date: string, amount: number, description?: string, payee?: string }} row
 *   Per una riga divisa nell'import, i dati dell'originale.
 * @param {{ date: string, amount: number, description?: string, payee?: string,
 *   split?: { originalAmount?: number, originalDescription?: string, originalPayee?: string } | null }} movement
 */
export function isDuplicateOf(row, movement) {
  if (row.date !== movement.date) return false;
  const rowTexts = [norm(row.description), norm(row.payee)].filter(Boolean);
  if (rowTexts.length === 0) return false;

  const matches = (amount, texts) =>
    toCents(amount) === toCents(row.amount) && texts.some((t) => t && rowTexts.includes(t));

  if (matches(movement.amount, [norm(movement.description), norm(movement.payee)])) return true;
  const s = movement.split;
  return !!s?.originalAmount
    && matches(s.originalAmount, [norm(s.originalDescription), norm(s.originalPayee)]);
}

/**
 * La riga da confrontare con il database: per una parte, l'originale della banca.
 *
 * @param {{ date: string, amount: number, description?: string, payee?: string, split?: object|null }} row
 */
export function duplicateKey(row) {
  const s = row.split;
  if (s?.originalAmount > 0) {
    return { date: row.date, amount: s.originalAmount, description: s.originalDescription ?? '', payee: s.originalPayee ?? '' };
  }
  return { date: row.date, amount: row.amount, description: row.description ?? '', payee: row.payee ?? '' };
}

/**
 * UUID v4 per il groupId di uno split creato nel browser. crypto.randomUUID esiste solo nei
 * contesti sicuri (HTTPS o localhost): aprendo l'app in HTTP da un indirizzo della rete di casa
 * mancherebbe. getRandomValues invece c'è sempre.
 */
export function newGroupId() {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Cambia l'importo di una parte nell'import: la differenza la assorbe un'altra parte dello stesso
 * gruppo (la successiva, o la precedente per l'ultima), così il totale resta quello della banca.
 *
 * @param {{ amount: number, split?: { groupId: string } | null }[]} rows
 * @param {number} index - La riga modificata.
 * @param {number} amount - Il nuovo importo in euro.
 * @returns {object[]|null} Le righe aggiornate, o null se un importo andrebbe a zero o sotto.
 */
export function setPartAmount(rows, index, amount) {
  const groupId = rows[index]?.split?.groupId;
  if (!groupId) return null;
  const members = rows.map((r, i) => (r.split?.groupId === groupId ? i : -1)).filter((i) => i >= 0);
  const pos = members.indexOf(index);
  const sibling = members[pos + 1] ?? members[pos - 1];
  if (sibling === undefined) return null;

  const original = toCents(rows[index].split.originalAmount);
  const value = toCents(amount);
  const others = members
    .filter((i) => i !== index && i !== sibling)
    .reduce((sum, i) => sum + toCents(rows[i].amount), 0);
  const rest = original - others - value;
  if (!Number.isFinite(value) || value <= 0 || rest <= 0) return null;

  return rows.map((r, i) => {
    if (i === index) return { ...r, amount: fromCents(value) };
    if (i === sibling) return { ...r, amount: fromCents(rest) };
    return r;
  });
}
