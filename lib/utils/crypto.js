import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
// Lunghezza del tag fissata anche in lettura: senza, Node accetta tag accorciati fino a 4 byte, e un
// valore falsificato nel database avrebbe molte più probabilità di passare per autentico.
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const secret = process.env.GOOGLE_DRIVE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error('Definire GOOGLE_DRIVE_TOKEN_SECRET o NEXTAUTH_SECRET');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(value) {
  if (!value) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(payload) {
  if (!payload) return null;

  const [ivBase64, authTagBase64, encryptedBase64] = payload.split('.');
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Formato secret cifrato non valido');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivBase64, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH },
  );

  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}