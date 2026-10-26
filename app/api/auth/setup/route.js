import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { MIN_PASSWORD_LENGTH, parseUserFields } from '@/lib/services/users';
import { serverTranslator } from '@/lib/i18n/server';

// Questo endpoint è attivo solo se non esiste ancora nessun utente nel DB.
// Una volta creato il primo admin, la rotta risponde 403.
export async function POST(req) {
  try {
    const t = await serverTranslator('errors');
    await connectDB();
    const count = await User.countDocuments();
    if (count > 0)
      return NextResponse.json({ error: t('setupDone') }, { status: 403 });

    const body = (await req.json().catch(() => null)) ?? {};
    if (!body.name || !body.email || !body.password)
      return NextResponse.json({ error: t('allFieldsRequired') }, { status: 400 });

    // Stesse regole della creazione di un utente da parte di un admin: prima un'email qualsiasi
    // (o un valore non testuale, che finiva in un 500) diventava l'account amministratore.
    const { data, error } = parseUserFields({ ...body, role: 'admin' });
    if (error) return NextResponse.json({ error: t(error) }, { status: 400 });

    if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH)
      return NextResponse.json({ error: t('passwordTooShort') }, { status: 400 });

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const user = await User.create({ ...data, hashedPassword });

    return NextResponse.json({ message: (await serverTranslator('apiMessages'))('adminCreated'), userId: user._id.toString() }, { status: 201 });
  } catch (err) {
    console.error('[setup]', err);
    return NextResponse.json({ error: (await serverTranslator('errors'))('internal') }, { status: 500 });
  }
}
