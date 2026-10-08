/**
 * @fileoverview POST /api/auth/forgot-password — avvia il recupero della password.
 *
 * Invia il link via email (se l'SMTP è configurato) e, a chi ha collegato Telegram, un codice:
 * il reset via Telegram funziona solo per un canale già verificato, mai per uno indicato adesso.
 * La risposta è sempre la stessa, così non rivela se l'email è registrata né quali canali ha.
 */

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { isDemoMode } from '@/lib/demoAccounts';
import User from '@/lib/models/User';
import PasswordResetToken from '@/lib/models/PasswordResetToken';
import { generateToken, hashToken, tokenExpiry } from '@/lib/utils/tokens';
import { sendPasswordResetEmail } from '@/lib/email';
import { emailConfigured, sendCode, telegramConfigured } from '@/lib/notify';
import { issueChallenge } from '@/lib/services/otp';
import { allowAttempt, clientIp } from '@/lib/rateLimit';
import { serverTranslator } from '@/lib/i18n/server';
import logger from '@/lib/logger';

export async function POST(req) {
  try {
    // Risposta generica per non rivelare se l'email esiste o meno
    const genericOk = NextResponse.json({ message: (await serverTranslator('apiMessages'))('resetRequested') });
    if (isDemoMode()) return genericOk;

    const { email } = (await req.json().catch(() => null)) ?? {};
    if (typeof email !== 'string' || !email) {
      return NextResponse.json({ error: (await serverTranslator('errors'))('emailRequired') }, { status: 400 });
    }

    await connectDB();
    if (!(await allowAttempt('send', clientIp(req.headers)))) {
      return NextResponse.json({ error: (await serverTranslator('errors'))('tooManyAttempts') }, { status: 429 });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.active === false) return genericOk;

    // Ogni canale fallisce per conto suo: un errore SMTP non deve impedire il codice su Telegram,
    // e nessuno dei due deve trasformarsi in una risposta diversa da quella generica.
    if (emailConfigured()) {
      await PasswordResetToken.deleteMany({ email: user.email });
      const token = generateToken();
      await PasswordResetToken.create({ email: user.email, tokenHash: hashToken(token), expiresAt: tokenExpiry(60) });

      // Stessa base del resto dell'app (vedi lib/services/googleDrive.js): così basta NEXTAUTH_URL, anche su Vercel.
      const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl: `${appUrl}/reset-password?token=${token}`, locale: user.locale })
        .catch((err) => logger.error('Email di reset non inviata', { error: err.message }));
    }

    if (telegramConfigured() && user.telegramChatId) {
      const { code } = await issueChallenge({ userId: user._id, purpose: 'reset', channel: 'telegram' });
      await sendCode({ user, channel: 'telegram', code, purpose: 'reset' })
        .catch((err) => logger.error('Codice di reset su Telegram non inviato', { error: err.message }));
    }

    return genericOk;
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: (await serverTranslator('errors'))('internal') }, { status: 500 });
  }
}
