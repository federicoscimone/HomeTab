import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { sendPasswordChangedEmail } from '@/lib/email';
import { isProtectedDemoAccount } from '@/lib/demoAccounts';
import { writeAudit } from '@/lib/utils/audit';
import logger from '@/lib/logger';
import { serverTranslator } from '@/lib/i18n/server';

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

    const t = await serverTranslator('errors');
    if (isProtectedDemoAccount(session.user.email)) {
      return NextResponse.json({ error: t('demoPasswordLocked') }, { status: 403 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword)
      return NextResponse.json({ error: t('missingData') }, { status: 400 });

    if (newPassword.length < 8)
      return NextResponse.json({ error: t('newPasswordTooShort') }, { status: 400 });

    if (newPassword === currentPassword)
      return NextResponse.json({ error: t('newPasswordSame') }, { status: 400 });

    await connectDB();
    const user = await User.findById(session.user.id);
    if (!user)
      return NextResponse.json({ error: t('userNotFound') }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!valid)
      return NextResponse.json({ error: t('wrongCurrentPassword') }, { status: 400 });

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
    await sendPasswordChangedEmail({ to: user.email, name: user.name, locale: user.locale })
      .catch((err) => logger.warn('Email di conferma cambio password non inviata', { error: err.message }));

    return NextResponse.json({ message: (await serverTranslator('apiMessages'))('passwordUpdated') });
  } catch (err) {
    console.error('[change-password]', err);
    return NextResponse.json({ error: (await serverTranslator('errors'))('internal') }, { status: 500 });
  }
}
