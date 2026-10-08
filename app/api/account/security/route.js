/**
 * @fileoverview GET /api/account/security — Telegram e verifica in due passaggi dell'utente collegato.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { securityOverview } from '@/lib/services/accountSecurity';

export async function GET() {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  await connectDB();
  const user = await User.findById(session.user.id).lean();
  return NextResponse.json(securityOverview(user));
}
