import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validWebhookSecret, webhookUrl } from '../lib/telegramBot.js';

test('il webhook si registra solo su HTTPS, con un\'impronta del segreto', () => {
  const url = webhookUrl('https://hometab.example.com/', 'segreto_1');
  assert.match(url, /^https:\/\/hometab\.example\.com\/api\/telegram\/webhook\?v=[0-9a-f]{8}$/);
  assert.equal(webhookUrl('http://192.168.1.53', 'segreto_1'), null);
  assert.equal(webhookUrl(undefined, 'segreto_1'), null);
  // Cambiando il segreto cambia l'indirizzo: così la registrazione automatica lo rifà.
  assert.notEqual(webhookUrl('https://h.example', 'a'), webhookUrl('https://h.example', 'b'));
});

test('il segreto rispetta i caratteri ammessi da Telegram', () => {
  assert.equal(validWebhookSecret('abc_DEF-123'), true);
  assert.equal(validWebhookSecret('con spazio'), false);
  assert.equal(validWebhookSecret('x'.repeat(257)), false);
  assert.equal(validWebhookSecret(''), false);
  assert.equal(validWebhookSecret(undefined), false);
});
