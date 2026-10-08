/**
 * @fileoverview Processo del bot Telegram: completa il collegamento delle chat agli utenti.
 *
 * Avvio: `node workers/telegram.js`, con MONGODB_URI, TELEGRAM_BOT_TOKEN e TELEGRAM_BOT_USERNAME (nel compose è il servizio `telegram`, sotto il profilo
 * omonimo). Il server è dietro NAT e non riceve webhook, quindi il bot chiede lui i messaggi a
 * Telegram con getUpdates (long polling). Inviare i codici invece lo fa l'app: è una chiamata
 * in uscita. Uno solo di questi processi per bot: Telegram rifiuta due getUpdates in parallelo.
 *
 * La logica delle risposte è in lib/telegramBot.js, condivisa con il webhook: questo processo
 * serve dove l'app non è raggiungibile da internet; altrove si usa il webhook.
 */

import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import BotState from '../lib/models/BotState.js';
import { botUsername, telegramCall, telegramConfigured } from '../lib/notify/telegram.js';
import { handleUpdate, webhookMode } from '../lib/telegramBot.js';
import { isLocale, DEFAULT_LOCALE } from '../lib/i18n/locale.js';

const POLL_SECONDS = 30;

/** Testi del bot dai messaggi dell'app: niente next-intl qui, quindi un'interpolazione minima. */
const MESSAGES = Object.fromEntries(['it', 'en'].map((locale) => [
  locale,
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).telegramBot,
]));
const text = (locale, key, vars = {}) =>
  MESSAGES[isLocale(locale) ? locale : DEFAULT_LOCALE][key].replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');

async function run() {
  if (!telegramConfigured()) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN e TELEGRAM_BOT_USERNAME sono obbligatori');
    process.exit(1);
  }
  if (webhookMode()) {
    // Con il webhook i messaggi li riceve l'app; questo processo all'avvio cancellerebbe il webhook.
    console.error('[telegram] TELEGRAM_WEBHOOK_SECRET è impostato: con il webhook questo processo non serve');
    process.exit(1);
  }
  // Connessione diretta, senza lib/mongodb.js: quel modulo porta con sé il logger dell'app
  // (winston), che nell'immagine standalone non è installato a parte, essendo dentro i bundle di Next.
  await mongoose.connect(process.env.MONGODB_URI);
  const stateId = botUsername();
  // Il bot non deve avere un webhook impostato: con un webhook attivo getUpdates è rifiutato.
  await telegramCall('deleteWebhook', { drop_pending_updates: false });
  console.log(`[telegram] in ascolto come @${stateId}`);

  let stopping = false;
  const controller = new AbortController();
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => { stopping = true; controller.abort(); });
  }

  while (!stopping) {
    try {
      const state = await BotState.findById(stateId).lean();
      const updates = await telegramCall(
        'getUpdates',
        { offset: state?.offset ?? 0, timeout: POLL_SECONDS, allowed_updates: ['message'] },
        { signal: controller.signal },
      );
      for (const update of updates) {
        try {
          await handleUpdate(update, text);
        } catch (err) {
          console.error('[telegram] messaggio non elaborato:', err.message);
        }
        // L'offset avanza anche se un messaggio fallisce: rielaborarlo all'infinito bloccherebbe il bot.
        await BotState.updateOne({ _id: stateId }, { offset: update.update_id + 1 }, { upsert: true });
      }
    } catch (err) {
      if (stopping) break;
      console.error('[telegram] getUpdates non riuscito, nuovo tentativo tra 5 s:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  console.log('[telegram] arresto');
  await mongoose.disconnect();
  process.exit(0);
}

run();
