import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret } from '../lib/utils/crypto.js';

process.env.NEXTAUTH_SECRET ??= 'segreto-di-prova';

test('un segreto cifrato si rilegge', () => {
  assert.equal(decryptSecret(encryptSecret('sk-prova-1234')), 'sk-prova-1234');
});

test('un tag di autenticazione accorciato viene rifiutato', () => {
  const [iv, tag, data] = encryptSecret('sk-prova-1234').split('.');
  const short = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');
  assert.throws(() => decryptSecret([iv, short, data].join('.')), /authentication tag length/);
});
