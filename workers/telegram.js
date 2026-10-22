/**
 * @fileoverview Processo del bot Telegram in modalità polling: riceve gli update e li consegna
 * all'app.
 *
 * Avvio: `node workers/telegram.js`, con MONGODB_URI, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME
 * e NEXTAUTH_SECRET (nel compose è il servizio `telegram`, sotto il profilo omonimo). Il server è
 * dietro NAT e non riceve webhook, quindi il bot chiede lui i messaggi a Telegram con getUpdates
 * (long polling). Uno solo di questi processi per bot: Telegram rifiuta due getUpdates in parallelo.
 *
 * Le risposte le dà l'app: ogni update va a POST /api/telegram/webhook, con il token ricavato dal
 * segreto del server (relayToken). Così la logica è una sola, con webhook o con polling, e può
 * usare l'IA e tutto il resto dell'app, che in questo processo non c'è. Se l'app non risponde,
 * l'update resta in coda su Telegram e si riprova: niente messaggi persi durante un riavvio.
 */

import mongoose from 'mongoose';
import BotState from '../lib/models/BotState.js';
import { botUsername, telegramCall, telegramConfigured } from '../lib/notify/telegram.js';
import { ALLOWED_UPDATES, relayToken, webhookMode } from '../lib/telegramBot.js';

const POLL_SECONDS = 30;
const APP_URL = (process.env.TELEGRAM_RELAY_URL || 'http://app:3000').replace(/\/+$/, '');

/** Consegna un update all'app; lancia un errore se l'app non l'ha accettato. */
async function relay(update, signal) {
  const res = await fetch(`${APP_URL}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HomeTab-Relay': relayToken() },
    body: JSON.stringify(update),
    signal,
  });
  if (!res.ok) throw new Error(`l'app ha risposto ${res.status}`);
}

async function run() {
  if (!telegramConfigured() || !relayToken()) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME e NEXTAUTH_SECRET sono obbligatori');
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
        { offset: state?.offset ?? 0, timeout: POLL_SECONDS, allowed_updates: ALLOWED_UPDATES },
        { signal: controller.signal },
      );
      for (const update of updates) {
        // L'offset avanza solo dopo la consegna: se l'app è giù, l'update si riprova al giro dopo.
        // Un update che l'app ha ricevuto ma non è riuscita a elaborare risponde comunque 200
        // (vedi la rotta), quindi non blocca il bot.
        await relay(update, controller.signal);
        await BotState.updateOne({ _id: stateId }, { offset: update.update_id + 1 }, { upsert: true });
      }
    } catch (err) {
      if (stopping) break;
      console.error('[telegram] ricezione o consegna non riuscita, nuovo tentativo tra 5 s:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  console.log('[telegram] arresto');
  await mongoose.disconnect();
  process.exit(0);
}

run();
