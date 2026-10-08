/**
 * @fileoverview API route — /api/utenti (solo amministratori)
 * GET  — elenco degli utenti.
 * POST — crea un utente con password provvisoria: { name, email, role, password }.
 *        Al primo accesso dovrà sceglierne una nuova.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { MIN_PASSWORD_LENGTH, parseUserFields, passwordError, toPublicUser } from '@/lib/services/users';
import { ROLE_INFO } from '@/lib/auth/permissions';
import { logApiError } from '@/lib/logger';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

export async function GET() {
  const { session, denied } = await requirePermission('users:manage');
  if (denied) return denied;

  await connectDB();
  const users = await User.find().select('-hashedPassword').sort({ active: -1, name: 1 }).lean();
  return NextResponse.json(users.map((u) => toPublicUser(u, session.user.id)));
}

export async function POST(req) {
  const { session, denied } = await requirePermission('users:manage');
  if (denied) return denied;

  const tErrors = await serverTranslator('errors');
  const body = (await req.json().catch(() => null)) ?? {};
  const { data, error } = parseUserFields(body);
  if (error) return NextResponse.json({ error: tErrors(error) }, { status: 400 });
  const pwdError = passwordError(body.password);
  if (pwdError) return NextResponse.json({ error: tErrors(pwdError, { min: MIN_PASSWORD_LENGTH }) }, { status: 400 });

  await connectDB();
  if (await User.exists({ email: data.email })) {
    return NextResponse.json({ error: tErrors('userEmailTaken') }, { status: 409 });
  }

  try {
    const user = await User.create({
      ...data,
      hashedPassword: await bcrypt.hash(body.password, 12),
      mustChangePassword: true,
      active: true,
    });
    await writeAudit(session, req, {
      action: 'CREATE',
      resource: 'user',
      resourceId: user._id,
      description: `Creato utente ${user.name} (${user.email}) — ${ROLE_INFO[user.role].label}`,
      meta: { role: user.role },
    });
    return NextResponse.json(toPublicUser(user.toObject(), session.user.id), { status: 201 });
  } catch (err) {
    logApiError('POST /api/utenti', err, { userId: session.user.id });
    return NextResponse.json({ error: tErrors('userCreateFailed') }, { status: 500 });
  }
}
