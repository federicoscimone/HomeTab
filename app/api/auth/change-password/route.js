import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { sendPasswordChangedEmail } from '@/lib/email';

export async function POST(req) {
  try {
    if (process.env.DEMO_MODE === 'true') {
      return NextResponse.json(
        { error: 'Cambio password disabilitato in modalità demo' },
        { status: 403 }
      );
    }

    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword)
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });

    if (newPassword.length < 8)
      return NextResponse.json({ error: 'La nuova password deve essere di almeno 8 caratteri' }, { status: 400 });

    await connectDB();
    const user = await User.findById(session.user.id);
    if (!user)
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!valid)
      return NextResponse.json({ error: 'Password attuale non corretta' }, { status: 400 });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.updateOne({ _id: user._id }, { hashedPassword });

    await sendPasswordChangedEmail({ to: user.email, name: user.name });

    return NextResponse.json({ message: 'Password aggiornata con successo' });
  } catch (err) {
    console.error('[change-password]', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
