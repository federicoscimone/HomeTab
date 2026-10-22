/**
 * @fileoverview API route — /api/cron/promemoria
 * GET — manda su Telegram i promemoria delle scadenze di oggi e gli avvisi dei budget (80% e
 * 100%, una volta per soglia e per mese). La chiama il cron giornaliero di
 * Vercel (vercel.json) con il segreto CRON_SECRET; su un server proprio, un cron di sistema:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/promemoria
 * Senza CRON_SECRET o senza bot Telegram non fa nulla. Nella demo è spenta.
 */

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { isDemoMode } from '@/lib/demoAccounts';
import { sendDeadlineReminders } from '@/lib/services/deadlines';
import { sendBudgetAlerts } from '@/lib/services/budgets';
import { bearerToken, secretMatches } from '@/lib/utils/secrets';
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale';
import { serverTranslator } from '@/lib/i18n/server';
import logger from '@/lib/logger';

const textIn = (namespace) => async (locale, key, vars) =>
  (await serverTranslator(namespace, isLocale(locale) ? locale : DEFAULT_LOCALE))(key, vars);

export async function GET(req) {
  if (!secretMatches(bearerToken(req), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  if (isDemoMode()) return NextResponse.json({ demo: true });
  await connectDB();
  const deadlines = await sendDeadlineReminders({ text: textIn('deadlines.telegram') });
  const budgets = await sendBudgetAlerts({ text: textIn('budgets.telegram') });
  logger.info('Promemoria del giorno', { deadlines, budgets });
  return NextResponse.json({ deadlines, budgets });
}
