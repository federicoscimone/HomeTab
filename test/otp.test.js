import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OTP_MAX_ATTEMPTS, challengeStatus, codeMatches, generateCode, normalizeCode, passwordAloneAllowed,
} from '../lib/auth/otp.js';
import { hashToken } from '../lib/utils/tokens.js';
import { clientIp } from '../lib/rateLimit.js';

const now = new Date('2026-10-08T10:00:00Z');
const later = new Date('2026-10-08T10:05:00Z');
const open = { usedAt: null, expiresAt: later, attempts: 0 };

test('il codice ha sempre sei cifre, zeri iniziali compresi', () => {
  for (let i = 0; i < 500; i++) assert.match(generateCode(), /^\d{6}$/);
});

test('il codice inserito tollera spazi e trattini, non altro', () => {
  assert.equal(normalizeCode(' 123 456 '), '123456');
  assert.equal(normalizeCode('123-456'), '123456');
  assert.equal(normalizeCode('12345'), null);
  assert.equal(normalizeCode('12345a'), null);
  assert.equal(normalizeCode(123456), null);
});

test('il confronto usa l\'hash, non il codice in chiaro', () => {
  assert.equal(codeMatches('004213', hashToken('004213')), true);
  assert.equal(codeMatches('004214', hashToken('004213')), false);
  assert.equal(codeMatches('004213', 'non-un-hash'), false);
});

test('scadenza, tentativi esauriti e riuso chiudono la sfida', () => {
  assert.equal(challengeStatus(open, now), 'open');
  assert.equal(challengeStatus({ ...open, expiresAt: now }, now), 'expired');
  assert.equal(challengeStatus({ ...open, attempts: OTP_MAX_ATTEMPTS }, now), 'exhausted');
  assert.equal(challengeStatus({ ...open, attempts: OTP_MAX_ATTEMPTS - 1 }, now), 'open');
  assert.equal(challengeStatus({ ...open, usedAt: now }, now), 'used');
});

test('con la 2FA attiva la password da sola non basta, tranne nella demo', () => {
  assert.equal(passwordAloneAllowed({ twoFactorEnabled: false }, false), true);
  assert.equal(passwordAloneAllowed({ twoFactorEnabled: true }, false), false);
  assert.equal(passwordAloneAllowed({ twoFactorEnabled: true }, true), true);
});

test('l\'IP del client è l\'ultimo indirizzo di X-Forwarded-For, quello scritto dal proxy', () => {
  // Il client manda un indirizzo falso, nginx aggiunge in coda quello vero: vale il secondo.
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' })), '203.0.113.7');
  assert.equal(clientIp({ 'x-forwarded-for': '198.51.100.1' }), '198.51.100.1');
  assert.equal(clientIp({ 'x-real-ip': '198.51.100.2' }), '198.51.100.2');
  assert.equal(clientIp(undefined), 'unknown');
});
