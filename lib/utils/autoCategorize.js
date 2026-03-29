/**
 * Cerca una corrispondenza keyword nelle stringhe di una riga.
 * I keyword sono già caricati dal DB (ordinati per priorità desc).
 *
 * @param {object} row - { description, payee, place }
 * @param {Array}  mappings - KeywordMapping docs ordinati per priority desc
 * @returns {{ categoryId, subCategory1Id } | null}
 */
export function autoCategorize(row, mappings) {
  const haystack = [row.payee, row.description, row.place]
    .filter(Boolean)
    .join(' ');

  for (const mapping of mappings) {
    const kw = mapping.keyword;
    const flags = mapping.caseSensitive ? '' : 'i';
    const regex = new RegExp(`\\b${escapeRegex(kw)}`, flags);

    if (regex.test(haystack)) {
      return {
        categoryId:    mapping.categoryId?._id?.toString() || mapping.categoryId?.toString() || null,
        subCategory1Id: mapping.subCategory1Id?._id?.toString() || mapping.subCategory1Id?.toString() || null,
      };
    }
  }

  return null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
