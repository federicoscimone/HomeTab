/**
 * @fileoverview /api/account/telegram — collegamento della chat Telegram dell'utente.
 * POST   — crea un token monouso e restituisce il link t.me/<bot>?start=<token>. Il collegamento
 *          si completa quando l'utente preme Start: lo registra workers/telegram.js.
 * DELETE — scollega la chat. Rifiutato se la 2FA usa Telegram: si resterebbe senza canale.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import TelegramLink from '@/lib/models/TelegramLink';
import { isDemoMode } from '@/lib/demoAccounts';
import { botUsername, telegramConfigured } from '@/lib/notify';
import { hashToken, tokenExpiry } from '@/lib/utils/tokens';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';

const LINK_MINUTES = 10;

/** @param {string} key - Chiave del namespace "errors". */
const fail = async (key, status) => NextResponse.json({ error: (await serverTranslator('errors'))(key) }, { status });

export async function POST() {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;
  if (isDemoMode()) return fail('demoUnavailable', 403);
  if (!telegramConfigured()) return fail('telegramNotConfigured', 503);

  await connectDB();
  // 32 byte in base64url: 43 caratteri, dentro il limite di 64 del parametro start di Telegram.
  const token = crypto.randomBytes(32).toString('base64url');
  await TelegramLink.deleteMany({ userId: session.user.id });
  await TelegramLink.create({ userId: session.user.id, tokenHash: hashToken(token), expiresAt: tokenExpiry(LINK_MINUTES) });

  return NextResponse.json({ url: `https://t.me/${botUsername()}?start=${token}`, minutes: LINK_MINUTES });
}

export async function DELETE(req) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;
  if (isDemoMode()) return fail('demoUnavailable', 403);

  await connectDB();
  const user = await User.findById(session.user.id);
  if (user.twoFactorEnabled && user.twoFactorChannel === 'telegram') return fail('twoFactorUsesTelegram', 409);

  user.telegramChatId = null;
  user.telegramLinkedAt = null;
  await user.save();
  await writeAudit(session, req, {
    action: 'UPDATE', resource: 'user', resourceId: String(user._id), description: `Scollegato Telegram di ${user.name}`,
  });
  return NextResponse.json({ linked: false });
}
