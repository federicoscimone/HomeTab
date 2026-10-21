/**
 * @fileoverview Filtro Mongo dei movimenti costruito dai parametri dell'URL.
 * @module lib/utils/movementFilter
 *
 * Unica fonte per l'elenco (/api/movimenti) e per l'esportazione (/api/movimenti/export). Prima
 * il codice era copiato nelle due rotte, e lo stesso errore stava in entrambe: categoria e
 * ricerca testuale scrivevano tutte e due `filter.$or`, quindi la ricerca annullava la categoria.
 */

import mongoose from 'mongoose';

/** @param {string} s */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {URLSearchParams} searchParams - from, to, categoryIds (separati da virgola),
 *   paymentMethod, paymentGroup, search, type, incomplete=1, excludeFromAnalysis=1, inAnalysis=1.
 * @returns {object} Filtro per `Movement.find` e `Movement.countDocuments`.
 */
export function buildMovementFilter(searchParams) {
  const from          = searchParams.get('from');
  const to            = searchParams.get('to');
  // ObjectId veri e non stringhe: find() le converterebbe da solo, aggregate() no, e i totali
  // della lista (e della chat) risultavano zero filtrando per categoria.
  const categoryIds   = (searchParams.get('categoryIds') || '').split(',').map((v) => v.trim())
    .filter((v) => mongoose.isValidObjectId(v)).map((v) => new mongoose.Types.ObjectId(v));
  const paymentMethod = searchParams.get('paymentMethod');
  const paymentGroup  = searchParams.get('paymentGroup');
  const search        = searchParams.get('search');
  const type          = searchParams.get('type');

  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to)   filter.date.$lte = to;
  }
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (paymentGroup)  filter.paymentGroup  = paymentGroup;
  if (type)          filter.type = type;

  // Ogni condizione "una fra" è un $or a sé, e devono valere tutte: quindi un $and di $or.
  const alternatives = [];
  if (categoryIds.length > 0) {
    alternatives.push({ $or: [
      { categoryId: { $in: categoryIds } },
      { subCategory1Id: { $in: categoryIds } },
      { subCategory2Id: { $in: categoryIds } },
    ] });
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    alternatives.push({ $or: [{ payee: rx }, { description: rx }, { place: rx }, { notes: rx }] });
  }
  if (alternatives.length > 0) filter.$and = alternatives;

  if (searchParams.get('incomplete') === '1') filter.categoryId = null;
  if (searchParams.get('excludeFromAnalysis') === '1') filter.excludeFromAnalysis = true;
  // Solo i movimenti che entrano nelle analisi, come nei report: il totale della lista coincide
  // con quello dei report (e della chat, che porta qui per verificarlo).
  else if (searchParams.get('inAnalysis') === '1') filter.excludeFromAnalysis = { $ne: true };

  return filter;
}
