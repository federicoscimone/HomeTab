/**
 * @fileoverview Lingue supportate e scelta della lingua di una richiesta.
 * @module lib/i18n/locale
 *
 * Nessuna dipendenza da Next: lo stesso modulo serve alla configurazione di next-intl
 * (i18n/request.js), alle route API (lib/i18n/server.js), al selettore nel browser e ai test.
 *
 * La lingua non sta nell'URL (niente /en/...): l'app è dietro login, dove l'indicizzazione per
 * lingua non serve, e così le rotte restano quelle di sempre. Si sceglie in quest'ordine:
 * il cookie, che l'utente imposta dal selettore; poi le lingue del browser (Accept-Language);
 * infine l'italiano.
 */

/** @typedef {'it'|'en'} Locale */

/** @type {Locale[]} */
export const LOCALES = ['it', 'en'];

/** @type {Locale} */
export const DEFAULT_LOCALE = 'it';

export const LOCALE_COOKIE = 'hometab-locale';

/**
 * Locale completo per Intl. L'inglese è quello britannico: giorno prima del mese e simbolo
 * dell'euro davanti alla cifra, più vicino all'uso europeo di quello americano.
 * @type {Record<Locale, string>}
 */
export const INTL_LOCALES = { it: 'it-IT', en: 'en-GB' };

/**
 * @param {unknown} value
 * @returns {value is Locale}
 */
export const isLocale = (value) => LOCALES.includes(/** @type {any} */ (value));

/**
 * @param {string|null|undefined} cookieValue - Valore del cookie hometab-locale.
 * @param {string|null|undefined} acceptLanguage - Header Accept-Language della richiesta.
 * @returns {Locale}
 *
 * @example
 * resolveLocale(undefined, 'en-US,en;q=0.9,it;q=0.8') // 'en'
 * resolveLocale('it', 'en-US')                         // 'it'
 */
export function resolveLocale(cookieValue, acceptLanguage) {
  if (isLocale(cookieValue)) return cookieValue;

  const preferred = (acceptLanguage || '')
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.lang && !Number.isNaN(entry.q) && entry.q > 0)
    // A parità di peso vale l'ordine in cui il browser le elenca.
    .sort((a, b) => b.q - a.q || a.index - b.index);

  return preferred.find((entry) => isLocale(entry.lang))?.lang ?? DEFAULT_LOCALE;
}
