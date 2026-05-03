import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import PasswordResetToken from '@/lib/models/PasswordResetToken';
import { generateToken, hashToken, tokenExpiry } from '@/lib/utils/tokens';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req) {
  try {
    if (process.env.DEMO_MODE === 'true') {
      return NextResponse.json(
        { message: 'Se l\'email è registrata, riceverai un link per il reset.' }
      );
    }

    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email obbligatoria' }, { status: 400 });

    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase() });

    // Risposta generica per non rivelare se l'email esiste o meno
    const genericOk = NextResponse.json({
      message: 'Se l\'email è registrata, riceverai un link per il reset.',
    });

    if (!user) return genericOk;

    // Invalida eventuali token precedenti non usati
    await PasswordResetToken.deleteMany({ email: user.email });

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = tokenExpiry(60); // 60 minuti

    await PasswordResetToken.create({ email: user.email, tokenHash, expiresAt });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });

    return genericOk;
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
