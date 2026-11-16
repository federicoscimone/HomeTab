import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTelegramRuntime, telegramRuntime, telegramConfigured, botUsername } from '../lib/notify/telegram.js';
import { telegramSettingsInput } from '../lib/utils/telegramSettingsInput.js';
import { defaultRelayUrl } from '../lib/telegramPolling.js';

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';

test('senza impostazioni salvate valgono le variabili d\'ambiente', () => {
  setTelegramRuntime(null);
  assert.deepEqual(telegramRuntime({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: '@casa_bot' }), {
    token: TOKEN, username: 'casa_bot', mode: 'polling', webhookSecret: null, source: 'env',
  });
  assert.equal(telegramRuntime({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: 'b', TELEGRAM_WEBHOOK_SECRET: 's' }).mode, 'webhook');
  assert.equal(telegramRuntime({ TELEGRAM_BOT_TOKEN: '', TELEGRAM_BOT_USERNAME: '' }).source, null);
});

test('le impostazioni salvate vincono sulle variabili d\'ambiente', () => {
  setTelegramRuntime({ token: TOKEN, username: 'nuovo_bot', mode: 'polling', webhookSecret: null, source: 'db' });
  assert.equal(telegramRuntime({ TELEGRAM_BOT_TOKEN: 'altro', TELEGRAM_BOT_USERNAME: 'vecchio_bot' }).username, 'nuovo_bot');
  assert.equal(telegramConfigured(), true);
  assert.equal(botUsername(), 'nuovo_bot');
  setTelegramRuntime(null);
});

test('telegramSettingsInput: token di @BotFather e modo', () => {
  assert.deepEqual(telegramSettingsInput({ token: ` ${TOKEN} `, mode: 'webhook' }).data, { token: TOKEN, mode: 'webhook' });
  assert.deepEqual(telegramSettingsInput({ mode: 'polling' }).data, { token: null, mode: 'polling' });
  assert.equal(telegramSettingsInput({ token: 'abc' }).error, 'telegramTokenInvalid');
  assert.equal(telegramSettingsInput({ token: `${TOKEN}\nX-Header: 1` }).error, 'telegramTokenInvalid');
  assert.equal(telegramSettingsInput({ token: 42 }).error, 'telegramTokenInvalid');
  assert.equal(telegramSettingsInput({ mode: 'push' }).error, 'invalidTelegramSettings');
  assert.equal(telegramSettingsInput(null).error, 'invalidTelegramSettings');
});

test('runtimeFrom: token cifrato letto con il segreto del server, null se il segreto è cambiato', async () => {
  const saved = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = 'segreto-di-prova';
  const { encryptSecret } = await import('../lib/utils/crypto.js');
  const { runtimeFrom } = await import('../lib/services/telegramSettings.js');
  const doc = { tokenEnc: encryptSecret(TOKEN), botUsername: 'casa_bot', mode: 'webhook', webhookSecretEnc: encryptSecret('s3greto') };
  assert.deepEqual(runtimeFrom(doc), { token: TOKEN, username: 'casa_bot', mode: 'webhook', webhookSecret: 's3greto', source: 'db' });
  assert.equal(runtimeFrom({ ...doc, mode: 'polling' }).webhookSecret, null);
  assert.equal(runtimeFrom(null), null);
  assert.equal(runtimeFrom({ tokenEnc: null }), null);
  process.env.NEXTAUTH_SECRET = 'un-altro-segreto';
  assert.equal(runtimeFrom(doc), null);
  process.env.NEXTAUTH_SECRET = saved;
});

test('defaultRelayUrl: nel container il server ascolta sull\'HOSTNAME di Docker', () => {
  assert.equal(defaultRelayUrl({ HOSTNAME: 'f1e3a8cb43fc', PORT: '3000' }), 'http://f1e3a8cb43fc:3000');
  assert.equal(defaultRelayUrl({ HOSTNAME: '0.0.0.0' }), 'http://127.0.0.1:3000');
  assert.equal(defaultRelayUrl({}), 'http://127.0.0.1:3000');
  assert.equal(defaultRelayUrl({ TELEGRAM_RELAY_URL: 'http://app:3000/' }), 'http://app:3000');
});
