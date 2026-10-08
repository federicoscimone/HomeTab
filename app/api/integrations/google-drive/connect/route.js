import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import { buildGoogleDriveAuthUrl, getGoogleDriveConfig } from '@/lib/services/googleDrive';
import { generateToken } from '@/lib/utils/tokens';

export async function POST() {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  try {
    getGoogleDriveConfig();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const state = generateToken();
  const authorizationUrl = buildGoogleDriveAuthUrl(state);
  const response = NextResponse.json({ authorizationUrl });

  response.cookies.set('google-drive-oauth-state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });

  return response;
}