import { decryptSecret, encryptSecret } from '@/lib/utils/crypto';

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const IDENTITY_SCOPES = ['openid', 'email', 'profile'];

export function getGoogleDriveConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || (baseUrl ? `${baseUrl}/api/integrations/google-drive/callback` : null);

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Configurare GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e APP_URL/NEXTAUTH_URL o GOOGLE_OAUTH_REDIRECT_URI');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scope: [...IDENTITY_SCOPES, DRIVE_SCOPE].join(' '),
  };
}

export function buildGoogleDriveAuthUrl(state) {
  const config = getGoogleDriveConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
}

async function readGoogleResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error_description || payload?.error?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(`Google API error: ${message}`);
  }

  return payload;
}

export async function exchangeGoogleCode(code) {
  const config = getGoogleDriveConfig();
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  return readGoogleResponse(response);
}

export async function refreshGoogleAccessToken(encryptedRefreshToken) {
  const config = getGoogleDriveConfig();
  const refreshToken = decryptSecret(encryptedRefreshToken);
  if (!refreshToken) {
    throw new Error('Refresh token Google Drive non disponibile');
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  return readGoogleResponse(response);
}

export async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  return readGoogleResponse(response);
}

async function googleJson(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  return readGoogleResponse(response);
}

export async function findBackupFolder(accessToken, folderName) {
  const params = new URLSearchParams({
    q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${folderName.replace(/'/g, "\\'")}'`,
    fields: 'files(id,name)',
    pageSize: '10',
  });

  const data = await googleJson(`${GOOGLE_DRIVE_FILES_URL}?${params.toString()}`, accessToken);
  return data.files?.[0] || null;
}

export async function createBackupFolder(accessToken, folderName) {
  return googleJson(GOOGLE_DRIVE_FILES_URL, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
}

export async function findOrCreateBackupFolder(accessToken, folderName) {
  return (await findBackupFolder(accessToken, folderName)) || createBackupFolder(accessToken, folderName);
}

export async function uploadBackupFile(accessToken, { folderId, fileName, mimeType, buffer }) {
  const boundary = `homebi-${Date.now().toString(16)}`;
  const metadata = {
    name: fileName,
    parents: folderId ? [folderId] : undefined,
  };

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8',
  );
  const ending = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([preamble, buffer, ending]);

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: 'id,name,webViewLink,createdTime',
  });

  return googleJson(`${GOOGLE_DRIVE_UPLOAD_URL}?${params.toString()}`, accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });
}

export function encryptRefreshToken(refreshToken) {
  return encryptSecret(refreshToken);
}

export function getDriveScope() {
  return DRIVE_SCOPE;
}