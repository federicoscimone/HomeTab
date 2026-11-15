import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInfo } from '../lib/buildInfo.js';

const SHA = '059b3858aeec4ffa563b745e54e46bfe649897ec';

test('build dalla CI: versione con lo SHA breve come metadato', () => {
  const info = buildInfo('1.4.2', { BUILD_SHA: SHA, BUILD_DATE: '2026-11-15T16:41:00.000Z', APP_ENV: 'lab-int' });
  assert.deepEqual(info, {
    name: 'hometab',
    version: '1.4.2+059b385',
    commit: SHA,
    shortCommit: '059b385',
    buildDate: '2026-11-15T16:41:00.000Z',
    environment: 'lab-int',
  });
});

test('build locale: versione -dev, nessun commit né data', () => {
  const info = buildInfo('1.4.2', {});
  assert.equal(info.version, '1.4.2-dev');
  assert.equal(info.commit, null);
  assert.equal(info.buildDate, null);
  assert.equal(info.environment, null);
});

test('Vercel: SHA e ambiente dalle variabili di sistema', () => {
  const info = buildInfo('1.0.0', { VERCEL_GIT_COMMIT_SHA: SHA, VERCEL_ENV: 'production' });
  assert.equal(info.version, '1.0.0+059b385');
  assert.equal(info.environment, 'production');
});

test('BUILD_SHA e APP_ENV hanno la precedenza su quelle di Vercel', () => {
  const info = buildInfo('1.0.0', { BUILD_SHA: 'a'.repeat(40), VERCEL_GIT_COMMIT_SHA: SHA, APP_ENV: 'lab-prod', VERCEL_ENV: 'preview' });
  assert.equal(info.shortCommit, 'aaaaaaa');
  assert.equal(info.environment, 'lab-prod');
});

test('valori non validi vengono ignorati, non mostrati', () => {
  const info = buildInfo('1.0.0', { BUILD_SHA: 'main', BUILD_DATE: 'ieri', APP_ENV: '<script>' });
  assert.equal(info.version, '1.0.0-dev');
  assert.equal(info.commit, null);
  assert.equal(info.buildDate, null);
  assert.equal(info.environment, null);
});

test('SHA in maiuscolo o con spazi viene normalizzato', () => {
  assert.equal(buildInfo('1.0.0', { BUILD_SHA: ` ${SHA.toUpperCase()}\n` }).commit, SHA);
});
