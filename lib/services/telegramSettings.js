/**
 * @fileoverview Configurazione del bot Telegram: quella salvata da Impostazioni → Telegram, o in
 * mancanza le variabili d'ambiente. Imposta la configurazione condivisa da tutto il processo
 * (lib/notify/telegram.js, telegramRuntime), così chi manda un messaggio non deve sapere da dove
 * viene il token.
 * @module lib/services/telegramSettings
 *
 * Solo import relativi: lo usa anche workers/telegram.js, fuori da Next. Richiede una connessione
 * Mongoose già aperta (o in apertura).
 */

import TelegramSettings from '../models/TelegramSettings.js';
import { decryptSecret } from '../utils/crypto.js';
import { setTelegramRuntime, telegramRuntime } from '../notify/telegram.js';

/** Quanto resta valida la copia in memoria: il supervisore del bot la rilegge a ogni giro. */
const TTL_MS = 30_000;
const LOADED_AT = Symbol.for('hometab.telegram.loadedAt');

/**
 * La configurazione del documento salvato, o null se non c'è un token utilizzabile (assente, o
 * cifrato con un segreto del server diverso da quello attuale).
 *
 * @param {object|null} doc - Documento TelegramSettings.
 * @returns {import('../notify/telegram.js').TelegramRuntime|null}
 */
export function runtimeFrom(doc) {
  if (!doc?.tokenEnc || !doc.botUsername) return null;
  try {
    const webhook = doc.mode === 'webhook';
    return {
      token: decryptSecret(doc.tokenEnc),
      username: doc.botUsername,
      mode: webhook ? 'webhook' : 'polling',
      webhookSecret: webhook ? decryptSecret(doc.webhookSecretEnc) : null,
      source: 'db',
    };
  } catch {
    return null;
  }
}

/**
 * Rilegge la configurazione dal database se la copia in memoria è più vecchia di 30 secondi.
 *
 * @param {{ force?: boolean }} [options] - force: subito, per esempio dopo un salvataggio.
 * @returns {Promise<import('../notify/telegram.js').TelegramRuntime>}
 */
export async function loadTelegramSettings({ force = false } = {}) {
  const loadedAt = globalThis[LOADED_AT];
  if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return telegramRuntime();
  const doc = await TelegramSettings.findById('telegram').lean();
  setTelegramRuntime(runtimeFrom(doc));
  globalThis[LOADED_AT] = Date.now();
  return telegramRuntime();
}
