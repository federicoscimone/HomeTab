/**
 * @fileoverview POST /api/account/telegram/test — un messaggio di prova sulla chat collegata di
 * chi lo chiede: dice subito se il bot riesce a scriverti.
 *
 * Il caso tipico di errore è un bot nuovo: Telegram non lascia scrivere un bot a chi non gli ha mai
 * premuto Start, quindi un collegamento fatto con il bot precedente va rifatto.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { isDemoMode } from '@/lib/demoAccounts';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { sendTelegramMessage, telegramConfigured, botUsername } from '@/lib/notify/telegram';
import { loadTelegramSettings } from '@/lib/services/telegramSettings';
import { allowAttempt } from '@/lib/rateLimit';
import { serverTranslator } from '@/lib/i18n/server';
import { buildInfo } from '@/lib/buildInfo';
import packageJson from '@/package.json';
import logger from '@/lib/logger';

const fail = async (key, status, vars) =>
  NextResponse.json({ error: (await serverTranslator('errors'))(key, vars) }, { status });

export async function POST() {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;
  if (isDemoMode()) return fail('demoUnavailable', 403);

  await connectDB();
  await loadTelegramSettings();
  if (!telegramConfigured()) return fail('telegramNotConfigured', 503);

  const user = await User.findById(session.user.id).select('name locale telegramChatId').lean();
  if (!user?.telegramChatId) return fail('telegramNotLinked', 409);
  if (!(await allowAttempt('send', `telegram-test:${session.user.id}`))) return fail('tooManyAttempts', 429);

  const t = await serverTranslator('telegramBot', user.locale);
  const build = buildInfo(packageJson.version);
  try {
    await sendTelegramMessage(user.telegramChatId, t('test', {
      name: user.name, version: build.version, environment: build.environment ?? '—',
    }));
  } catch (err) {
    const description = String(err.message).replace(/^Telegram sendMessage: /, '');
    logger.warn('Messaggio di prova Telegram non inviato', { userId: session.user.id, error: description });
    // 403: chat bloccata, o mai avviata con questo bot (tipico dopo un cambio di bot).
    if (/forbidden|chat not found/i.test(description)) return fail('telegramTestBlocked', 409, { bot: botUsername() });
    return fail('telegramTestFailed', 502, { reason: description.slice(0, 200) });
  }
  return NextResponse.json({ sent: true });
}
