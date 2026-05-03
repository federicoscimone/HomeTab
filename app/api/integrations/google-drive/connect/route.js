import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildGoogleDriveAuthUrl, getGoogleDriveConfig } from '@/lib/services/googleDrive';
import { generateToken } from '@/lib/utils/tokens';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

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