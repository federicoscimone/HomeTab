/**
 * @fileoverview API route — /api/cron/promemoria
 * GET — manda su Telegram i promemoria delle scadenze di oggi. La chiama il cron giornaliero di
 * Vercel (vercel.json) con il segreto CRON_SECRET; su un server proprio, un cron di sistema:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/promemoria
 * Senza CRON_SECRET o senza bot Telegram non fa nulla. Nella demo è spenta.
 */

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { isDemoMode } from '@/lib/demoAccounts';
import { sendDeadlineReminders } from '@/lib/services/deadlines';
import { bearerToken, secretMatches } from '@/lib/utils/secrets';
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale';
import { serverTranslator } from '@/lib/i18n/server';
import logger from '@/lib/logger';

const text = async (locale, key, vars) =>
  (await serverTranslator('deadlines.telegram', isLocale(locale) ? locale : DEFAULT_LOCALE))(key, vars);

export async function GET(req) {
  if (!secretMatches(bearerToken(req), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  if (isDemoMode()) return NextResponse.json({ sent: 0, deadlines: 0, demo: true });
  await connectDB();
  const result = await sendDeadlineReminders({ text });
  logger.info('Promemoria delle scadenze', result);
  return NextResponse.json(result);
}
