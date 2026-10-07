/**
 * @fileoverview Traduzioni nelle route API e nel codice server fuori dai componenti.
 * @module lib/i18n/server
 *
 * Nei componenti next-intl conosce la lingua da i18n/request.js; nelle route handler no, va
 * passata esplicitamente. Qui la si ricava con la stessa regola delle pagine (cookie, poi
 * Accept-Language), così un errore restituito da un'API è nella lingua dell'interfaccia.
 */

import { cookies, headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { LOCALE_COOKIE, isLocale, resolveLocale } from './locale.js';

/** @returns {Promise<import('./locale.js').Locale>} Lingua della richiesta corrente. */
export async function requestLocale() {
  return resolveLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    (await headers()).get('accept-language'),
  );
}

/**
 * @param {string} namespace - Sezione di messages/*.json, es. 'errors'.
 * @param {string|null} [locale] - Lingua esplicita (es. quella salvata sull'utente per un'email);
 *   se manca o non è valida si usa quella della richiesta.
 */
export async function serverTranslator(namespace, locale = null) {
  return getTranslations({ locale: isLocale(locale) ? locale : await requestLocale(), namespace });
}
