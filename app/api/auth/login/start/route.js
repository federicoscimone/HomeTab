/**
 * @fileoverview POST /api/auth/login/start — primo passo del login.
 *
 * Verifica email e password. Se l'utente non ha la verifica in due passaggi risponde
 * { step: 'password' } e il browser completa il login con NextAuth come sempre. Se ce l'ha,
 * invia un codice sul canale scelto e risponde { step: 'code', ticket, channel }: il browser
 * completa il login passando ad authorize() ticket e codice (vedi auth.js).
 *
 * Gli errori sulle credenziali sono sempre generici, come nel login normale.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { isDemoMode } from '@/lib/demoAccounts';
import { passwordAloneAllowed } from '@/lib/auth/otp';
import { issueChallenge } from '@/lib/services/otp';
import { availableChannels, sendCode } from '@/lib/notify';
import { allowAttempt, clientIp } from '@/lib/rateLimit';
import { serverTranslator } from '@/lib/i18n/server';
import logger from '@/lib/logger';

export async function POST(req) {
  const t = await serverTranslator('errors');
  const fail = (key, status) => NextResponse.json({ error: t(key) }, { status });
  const ip = clientIp(req.headers);

  const { email, password } = (await req.json().catch(() => null)) ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return fail('invalidCredentials', 400);
  }

  await connectDB();
  if (!(await allowAttempt('login', ip))) return fail('tooManyAttempts', 429);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || user.active === false || !(await bcrypt.compare(password, user.hashedPassword))) {
    return fail('invalidCredentials', 401);
  }

  if (passwordAloneAllowed(user, isDemoMode())) return NextResponse.json({ step: 'password' });

  // Il canale scelto se è ancora disponibile, altrimenti un altro: se per esempio l'SMTP è stato
  // tolto, il codice arriva comunque su Telegram invece di lasciare l'utente fuori.
  const channels = availableChannels(user);
  const channel = channels.includes(user.twoFactorChannel) ? user.twoFactorChannel : channels[0];
  if (!channel) {
    logger.warn('Login con 2FA senza canali disponibili', { userId: String(user._id) });
    return fail('codeChannelUnavailable', 503);
  }

  if (!(await allowAttempt('send', ip))) return fail('tooManyAttempts', 429);
  const { code, ticket } = await issueChallenge({ userId: user._id, purpose: 'login', channel, withTicket: true });
  try {
    await sendCode({ user, channel, code, purpose: 'login' });
  } catch (err) {
    logger.error('Invio del codice di accesso non riuscito', { userId: String(user._id), channel, error: err.message });
    return fail('codeSendFailed', 502);
  }

  return NextResponse.json({ step: 'code', ticket, channel });
}
