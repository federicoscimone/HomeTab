/**
 * @fileoverview Configurazione di next-intl per ogni richiesta: lingua e messaggi.
 *
 * Il root layout passa tutto al NextIntlClientProvider, quindi componenti server e client
 * leggono la stessa lingua. Le route API invece la ricavano da sé con lib/i18n/server.js.
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, isLocale, resolveLocale } from '@/lib/i18n/locale';

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  // Una lingua esplicita (getTranslations({ locale })) vince su quella della richiesta: serve alle
  // email, che partono nella lingua salvata sull'utente. Senza questo controllo i messaggi
  // venivano caricati comunque nella lingua del browser.
  const locale = isLocale(explicitLocale)
    ? explicitLocale
    : resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get('accept-language'));

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Fuso fisso: date e mesi dei movimenti sono locali italiani, e senza un fuso esplicito
    // server e browser potrebbero formattare la stessa data in giorni diversi.
    timeZone: 'Europe/Rome',
  };
});
