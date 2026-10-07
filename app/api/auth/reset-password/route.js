import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import { isDemoMode } from '@/lib/demoAccounts';
import User from '@/lib/models/User';
import PasswordResetToken from '@/lib/models/PasswordResetToken';
import { hashToken } from '@/lib/utils/tokens';
import { sendPasswordChangedEmail } from '@/lib/email';
import logger from '@/lib/logger';

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

// POST: applica la nuova password
export async function POST(req) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { error: 'Reset password disabilitato in modalità demo' },
        { status: 403 }
      );
    }

    const { token, password } = await req.json();

    if (!token || !password)
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });

    if (password.length < 8)
      return NextResponse.json({ error: 'La password deve essere di almeno 8 caratteri' }, { status: 400 });

    await connectDB();

    const record = await PasswordResetToken.findOne({
      tokenHash: hashToken(token),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!record)
      return NextResponse.json({ error: 'Link non valido o scaduto' }, { status: 400 });

    const user = await User.findOne({ email: record.email });
    if (!user)
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });

    const hashedPassword = await bcrypt.hash(password, 12);
    // Come nel cambio password: la nuova password l'ha scelta l'utente, quindi non è più provvisoria,
    // e le sessioni aperte con quella vecchia decadono.
    await User.updateOne(
      { _id: user._id },
      { hashedPassword, mustChangePassword: false, $inc: { sessionVersion: 1 } },
    );

    // Marca il token come usato (verrà eliminato dall'indice TTL)
    await PasswordResetToken.updateOne({ _id: record._id }, { used: true });

    // Notifica di cortesia: se l'invio fallisce (es. SMTP non configurato) la password è già
    // cambiata, e rispondere 500 farebbe credere all'utente il contrario.
    await sendPasswordChangedEmail({ to: user.email, name: user.name })
      .catch((err) => logger.warn('Email di conferma cambio password non inviata', { error: err.message }));

    return NextResponse.json({ message: 'Password aggiornata con successo' });
  } catch (err) {
    console.error('[reset-password POST]', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
