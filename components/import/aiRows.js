/**
 * @fileoverview Righe da chiedere all'IA, condivise dalla revisione dell'import e da quella dei
 * movimenti incompleti.
 * @module components/import/aiRows
 */

/** Righe da chiedere all'IA: senza categoria, non duplicate e non già sistemate a mano. */
export const needsSuggestion = (r) => !r.categoryId && !r._isDuplicate && !r._catManual;

/** I campi che lasciano il browser verso il server; il server li maschera prima del modello. */
export const toAiRow = (r) => ({
  id: r._rowId, description: r.description, payee: r.payee, place: r.place, type: r.type, amount: r.amount,
  bankCategory: r.bankCategory || '',
});
