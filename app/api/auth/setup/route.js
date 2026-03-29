import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

// Questo endpoint è attivo solo se non esiste ancora nessun utente nel DB.
// Una volta creato il primo admin, la rotta risponde 403.
export async function POST(req) {
  try {
    await connectDB();
    const count = await User.countDocuments();
    if (count > 0)
      return NextResponse.json({ error: 'Setup già completato' }, { status: 403 });

    const { name, email, password } = await req.json();
    if (!name || !email || !password)
      return NextResponse.json({ error: 'Tutti i campi sono obbligatori' }, { status: 400 });

    if (password.length < 8)
      return NextResponse.json({ error: 'La password deve essere di almeno 8 caratteri' }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: email.toLowerCase(), hashedPassword, role: 'admin' });

    return NextResponse.json({ message: 'Admin creato', userId: user._id.toString() }, { status: 201 });
  } catch (err) {
    console.error('[setup]', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
