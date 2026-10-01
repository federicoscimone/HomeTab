import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { sendPasswordChangedEmail } from '@/lib/email';
import { isProtectedDemoAccount } from '@/lib/demoAccounts';
import { writeAudit } from '@/lib/utils/audit';
import logger from '@/lib/logger';

/**
 * Cambio della propria password, anche quella provvisoria assegnata da un admin.
 *
 * Incrementa `sessionVersion`: tutte le sessioni aperte con la vecchia password decadono, compresa
 * quella che ha fatto la richiesta. Il client deve quindi rifare l'accesso con la nuova password
 * (lo fa components/account/ChangePasswordForm.js).
 */
export async function POST(req) {
  try {
    const { session, denied } = await requirePermission('data:read', { allowPendingPassword: true });
    if (denied) return denied;

    if (isProtectedDemoAccount(session.user.email)) {
      return NextResponse.json(
        { error: 'La password degli account demo non si può cambiare' },
        { status: 403 }
      );
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword)
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });

    if (newPassword.length < 8)
      return NextResponse.json({ error: 'La nuova password deve essere di almeno 8 caratteri' }, { status: 400 });

    if (newPassword === currentPassword)
      return NextResponse.json({ error: 'La nuova password deve essere diversa da quella attuale' }, { status: 400 });

    await connectDB();
    const user = await User.findById(session.user.id);
    if (!user)
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!valid)
      return NextResponse.json({ error: 'Password attuale non corretta' }, { status: 400 });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.updateOne(
      { _id: user._id },
      { hashedPassword, mustChangePassword: false, $inc: { sessionVersion: 1 } },
    );

    await writeAudit(session, req, {
      action: 'PASSWORD_CHANGE',
      resource: 'user',
      resourceId: user._id,
      description: user.mustChangePassword
        ? `${user.name} ha sostituito la password provvisoria`
        : `${user.name} ha cambiato la propria password`,
    });
    // Notifica di cortesia: se l'invio fallisce (es. SMTP non configurato) la password è già
    // cambiata, e rispondere 500 farebbe credere all'utente il contrario.
    await sendPasswordChangedEmail({ to: user.email, name: user.name })
      .catch((err) => logger.warn('Email di conferma cambio password non inviata', { error: err.message }));

    return NextResponse.json({ message: 'Password aggiornata con successo' });
  } catch (err) {
    console.error('[change-password]', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
