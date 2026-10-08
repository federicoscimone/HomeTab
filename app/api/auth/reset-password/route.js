import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import { isDemoMode } from '@/lib/demoAccounts';
import User from '@/lib/models/User';
import PasswordResetToken from '@/lib/models/PasswordResetToken';
import { hashToken } from '@/lib/utils/tokens';
import { sendPasswordChangedEmail } from '@/lib/email';
import logger from '@/lib/logger';
import { serverTranslator } from '@/lib/i18n/server';
import { verifyUserCode } from '@/lib/services/otp';
import { allowAttempt, clientIp } from '@/lib/rateLimit';

// GET: verifica validità token (usato dal frontend prima di mostrare il form)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) return NextResponse.json({ valid: false });

    await connectDB();
    const record = await PasswordResetToken.findOne({
      tokenHash: hashToken(token),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    return NextResponse.json({ valid: !!record });
  } catch (err) {
    console.error('[reset-password GET]', err);
    return NextResponse.json({ valid: false });
  }
}

// POST: applica la nuova password, con il token del link email oppure con email + codice Telegram
export async function POST(req) {
  try {
    const t = await serverTranslator('errors');
    if (isDemoMode()) {
      return NextResponse.json({ error: t('demoResetDisabled') }, { status: 403 });
    }

    const { token, email, code, password } = (await req.json().catch(() => null)) ?? {};

    if ((!token && !(email && code)) || typeof password !== 'string')
      return NextResponse.json({ error: t('missingData') }, { status: 400 });

    if (password.length < 8)
      return NextResponse.json({ error: t('passwordTooShort') }, { status: 400 });

    await connectDB();

    let user;
    if (token) {
      // Il token si consuma con un aggiornamento condizionato (used ancora false): prima la
      // lettura e la marcatura erano separate, e due richieste parallele con lo stesso link
      // potevano passare entrambe.
      const record = await PasswordResetToken.findOneAndUpdate(
        { tokenHash: hashToken(String(token)), used: false, expiresAt: { $gt: new Date() } },
        { used: true },
      );
      if (!record)
        return NextResponse.json({ error: t('invalidResetLink') }, { status: 400 });
      user = await User.findOne({ email: record.email });
    } else {
      if (!(await allowAttempt('code', clientIp(req.headers))))
        return NextResponse.json({ error: t('tooManyAttempts') }, { status: 429 });
      // Stesso errore per email sconosciuta e codice sbagliato: non rivela chi è registrato.
      const candidate = await User.findOne({ email: String(email).toLowerCase() });
      const result = candidate ? await verifyUserCode({ userId: candidate._id, purpose: 'reset', code }) : { ok: false };
      if (!result.ok)
        return NextResponse.json({ error: t('invalidResetCode') }, { status: 400 });
      user = candidate;
    }

    if (!user)
      return NextResponse.json({ error: t('userNotFound') }, { status: 404 });

    const hashedPassword = await bcrypt.hash(password, 12);
    // Come nel cambio password: la nuova password l'ha scelta l'utente, quindi non è più provvisoria,
    // e le sessioni aperte con quella vecchia decadono.
    await User.updateOne(
      { _id: user._id },
      { hashedPassword, mustChangePassword: false, $inc: { sessionVersion: 1 } },
    );

    // Notifica di cortesia: se l'invio fallisce (es. SMTP non configurato) la password è già
    // cambiata, e rispondere 500 farebbe credere all'utente il contrario.
    await sendPasswordChangedEmail({ to: user.email, name: user.name, locale: user.locale })
      .catch((err) => logger.warn('Email di conferma cambio password non inviata', { error: err.message }));

    return NextResponse.json({ message: (await serverTranslator('apiMessages'))('passwordUpdated') });
  } catch (err) {
    console.error('[reset-password POST]', err);
    return NextResponse.json({ error: (await serverTranslator('errors'))('internal') }, { status: 500 });
  }
}
