/**
 * @fileoverview Righe dell'import accettate dalle rotte dell'IA: solo i campi che servono.
 * @module lib/ai/tasks/importRows
 */

/** Righe al massimo per richiesta: un estratto conto mensile ne ha qualche centinaio. */
export const MAX_ROWS = 1000;
const TEXT_MAX = 300;

/** Solo i campi che servono, come stringhe corte: il resto della riga non lascia il server. */
export function cleanRow(r) {
  const s = (v) => (typeof v === 'string' ? v.slice(0, TEXT_MAX) : '');
  return {
    id: r.id,
    description: s(r.description),
    payee: s(r.payee),
    place: s(r.place),
    type: r.type === 'income' ? 'income' : 'expense',
    amount: Number.isFinite(r.amount) ? r.amount : 0,
  };
}

/** @returns {object[]|null} Le righe ripulite, o null se il corpo non è valido. */
export function validRows(body) {
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length === 0 || rows.length > MAX_ROWS || rows.some((r) => !Number.isInteger(r?.id))) return null;
  return rows.map(cleanRow);
}
