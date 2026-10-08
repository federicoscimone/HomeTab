/**
 * @fileoverview POST /api/account/two-factor/code — invia un codice di prova sul canale scelto.
 *
 * La 2FA si attiva solo dopo averlo ricevuto e inserito: così chi la attiva ha la prova che il
 * canale funziona, invece di scoprirlo al login successivo restando chiuso fuori.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { isDemoMode } from '@/lib/demoAccounts';
import { availableChannels, sendCode } from '@/lib/notify';
import { issueChallenge } from '@/lib/services/otp';
import { allowAttempt, clientIp } from '@/lib/rateLimit';
import { serverTranslator } from '@/lib/i18n/server';
import logger from '@/lib/logger';

export async function POST(req) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;
  const t = await serverTranslator('errors');
  const fail = (key, status) => NextResponse.json({ error: t(key) }, { status });
  if (isDemoMode()) return fail('demoUnavailable', 403);

  const { channel } = (await req.json().catch(() => null)) ?? {};
  await connectDB();
  const user = await User.findById(session.user.id);
  if (!availableChannels(user).includes(channel)) return fail('channelUnavailable', 400);
  if (!(await allowAttempt('send', clientIp(req.headers)))) return fail('tooManyAttempts', 429);

  const { code } = await issueChallenge({ userId: user._id, purpose: 'enable', channel });
  try {
    await sendCode({ user, channel, code, purpose: 'enable' });
  } catch (err) {
    logger.error('Invio del codice di attivazione non riuscito', { userId: String(user._id), channel, error: err.message });
    return fail('codeSendFailed', 502);
  }
  return NextResponse.json({ sent: true, channel });
}
