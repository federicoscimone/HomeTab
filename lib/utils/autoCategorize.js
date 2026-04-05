/**
 * @fileoverview Auto-categorization engine based on keyword mapping.
 * @module lib/utils/autoCategorize
 */

/**
 * @typedef {Object} AutoCategorizeRow
 * @property {string} [description] - Causale / transaction description.
 * @property {string} [payee]       - Esercente / merchant name.
 * @property {string} [place]       - Transaction location.
 */

/**
 * @typedef {Object} AutoCategorizeResult
 * @property {string|null} categoryId     - Matched category ObjectId string.
 * @property {string|null} subCategory1Id - Matched sub-category ObjectId string.
 */

/**
 * Attempts to assign a category to a transaction row by testing each keyword
 * mapping (sorted by priority desc) against the concatenated searchable fields.
 *
 * The first matching keyword wins — higher priority mappings are checked first.
 *
 * @param {AutoCategorizeRow} row      - Transaction fields to match against.
 * @param {object[]}          mappings - KeywordMapping documents, sorted by priority desc.
 * @returns {AutoCategorizeResult|null} Matched category IDs, or null if no match.
 *
 * @example
 * const result = autoCategorize(
 *   { payee: 'Esselunga', description: 'Spesa supermercato' },
 *   keywordMappings,
 * );
 * // result → { categoryId: '...', subCategory1Id: '...' }
 */
export function autoCategorize(row, mappings) {
  const haystack = [row.payee, row.description, row.place]
    .filter(Boolean)
    .join(' ');

  for (const mapping of mappings) {
    const flags = mapping.caseSensitive ? '' : 'i';
    const regex = new RegExp(`\\b${escapeRegex(mapping.keyword)}`, flags);

    if (regex.test(haystack)) {
      return {
        categoryId:     mapping.categoryId?._id?.toString()     || mapping.categoryId?.toString()     || null,
        subCategory1Id: mapping.subCategory1Id?._id?.toString() || mapping.subCategory1Id?.toString() || null,
      };
    }
  }

  return null;
}

/**
 * Escapes all regex special characters in a string so it can be used
 * as a literal pattern inside `new RegExp()`.
 *
 * @param {string} s - Raw string to escape.
 * @returns {string} Regex-safe string.
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
