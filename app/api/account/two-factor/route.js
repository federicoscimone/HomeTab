/**
 * @fileoverview /api/account/two-factor — verifica in due passaggi dell'utente collegato.
 * POST   — { channel, code }: attiva la 2FA (o cambia canale) con il codice appena ricevuto.
 * DELETE — { password }: la disattiva. Serve la password: chi trova una sessione aperta su un
 *          computer lasciato acceso non deve poter togliere la protezione.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { isDemoMode } from '@/lib/demoAccounts';
import { verifyUserCode } from '@/lib/services/otp';
import { securityOverview } from '@/lib/services/accountSecurity';
import { allowAttempt, clientIp } from '@/lib/rateLimit';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

async function context(req) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return { denied };
  const t = await serverTranslator('errors');
  const fail = (key, status) => NextResponse.json({ error: t(key) }, { status });
  if (isDemoMode()) return { denied: fail('demoUnavailable', 403) };
  if (!(await allowAttempt('code', clientIp(req.headers)))) return { denied: fail('tooManyAttempts', 429) };
  await connectDB();
  return { session, fail, user: await User.findById(session.user.id) };
}

export async function POST(req) {
  const { denied, session, fail, user } = await context(req);
  if (denied) return denied;

  const { channel, code } = (await req.json().catch(() => null)) ?? {};
  const result = await verifyUserCode({ userId: user._id, purpose: 'enable', code });
  // Il codice deve venire dal canale che si sta attivando, non da un altro.
  if (!result.ok || result.channel !== channel) return fail('invalidCode', 400);

  user.twoFactorEnabled = true;
  user.twoFactorChannel = channel;
  await user.save();
  await writeAudit(session, req, {
    action: 'UPDATE', resource: 'user', resourceId: String(user._id),
    description: `Verifica in due passaggi attivata per ${user.name} (${channel})`,
  });
  return NextResponse.json(securityOverview(user));
}

export async function DELETE(req) {
  const { denied, session, fail, user } = await context(req);
  if (denied) return denied;

  const { password } = (await req.json().catch(() => null)) ?? {};
  if (typeof password !== 'string' || !(await bcrypt.compare(password, user.hashedPassword))) {
    return fail('wrongCurrentPassword', 400);
  }

  user.twoFactorEnabled = false;
  user.twoFactorChannel = null;
  await user.save();
  await writeAudit(session, req, {
    action: 'UPDATE', resource: 'user', resourceId: String(user._id),
    description: `Verifica in due passaggi disattivata per ${user.name}`,
  });
  return NextResponse.json(securityOverview(user));
}
