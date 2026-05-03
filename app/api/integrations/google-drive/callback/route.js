import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import GoogleDriveIntegration from '@/lib/models/GoogleDriveIntegration';
import {
  buildGoogleDriveAuthUrl,
  encryptRefreshToken,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleDriveConfig,
} from '@/lib/services/googleDrive';
import { writeAudit } from '@/lib/utils/audit';
import { logApiError } from '@/lib/logger';

const SETTINGS_URL = '/impostazioni';

export async function GET(req) {
  const session = await auth();
  const redirectUrl = new URL(SETTINGS_URL, req.url);

  if (!session?.user?.id) {
    redirectUrl.searchParams.set('driveError', 'sessione');
    return NextResponse.redirect(redirectUrl);
  }

  const state = new URL(req.url).searchParams.get('state');
  const code = new URL(req.url).searchParams.get('code');
  const error = new URL(req.url).searchParams.get('error');
  const cookieState = req.cookies.get('google-drive-oauth-state')?.value;

  if (error) {
    redirectUrl.searchParams.set('driveError', error);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('google-drive-oauth-state', '', { path: '/', maxAge: 0 });
    return response;
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    redirectUrl.searchParams.set('driveError', 'state');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('google-drive-oauth-state', '', { path: '/', maxAge: 0 });
    return response;
  }

  try {
    getGoogleDriveConfig();
    const tokenData = await exchangeGoogleCode(code);
    const googleUser = await fetchGoogleUserInfo(tokenData.access_token);

    await connectDB();
    const existing = await GoogleDriveIntegration.findOne({ userId: session.user.id });
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptRefreshToken(tokenData.refresh_token)
      : existing?.encryptedRefreshToken;

    if (!encryptedRefreshToken) {
      throw new Error('Google non ha restituito un refresh token utilizzabile');
    }

    const integration = await GoogleDriveIntegration.findOneAndUpdate(
      { userId: session.user.id },
      {
        $set: {
          email: session.user.email,
          googleEmail: googleUser.email || null,
          googleAccountId: googleUser.sub || null,
          encryptedRefreshToken,
          tokenScope: tokenData.scope || '',
          isConnected: true,
          connectedAt: new Date(),
          lastBackupError: null,
        },
        $setOnInsert: {
          folderName: 'HomeBI Backups',
          autoBackupEnabled: false,
          backupFrequency: 'weekly',
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    await writeAudit(session, req, {
      action: 'BACKUP_CONNECT',
      resource: 'backup',
      resourceId: integration._id,
      description: `Google Drive collegato${googleUser.email ? ` (${googleUser.email})` : ''}`,
      meta: {
        googleEmail: googleUser.email || null,
        tokenScope: tokenData.scope || '',
      },
    });

    redirectUrl.searchParams.set('driveConnected', '1');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('google-drive-oauth-state', '', { path: '/', maxAge: 0 });
    return response;
  } catch (callbackError) {
    logApiError('GET /api/integrations/google-drive/callback', callbackError, { userId: session.user.id });
    redirectUrl.searchParams.set('driveError', 'callback');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('google-drive-oauth-state', '', { path: '/', maxAge: 0 });
    return response;
  }
}