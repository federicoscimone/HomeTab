import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
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

    const { name, email, password } = await req.json();
    if (!name || !email || !password)
      return NextResponse.json({ error: t('allFieldsRequired') }, { status: 400 });

    if (password.length < 8)
      return NextResponse.json({ error: t('passwordTooShort') }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: email.toLowerCase(), hashedPassword, role: 'admin' });

    return NextResponse.json({ message: (await serverTranslator('apiMessages'))('adminCreated'), userId: user._id.toString() }, { status: 201 });
  } catch (err) {
    console.error('[setup]', err);
    return NextResponse.json({ error: (await serverTranslator('errors'))('internal') }, { status: 500 });
  }
}
