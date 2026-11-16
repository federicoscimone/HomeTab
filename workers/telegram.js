/**
 * @fileoverview Processo separato per ricevere i messaggi del bot Telegram. **Non serve più**:
 * l'app li riceve da sé (lib/telegramPolling.js, avviato da instrumentation.js).
 *
 * Resta per le installazioni che hanno ancora il servizio `telegram` del compose (profilo
 * omonimo): usa lo stesso codice dell'app e lo stesso lucchetto su Mongo, quindi riceve uno solo
 * dei due e l'altro aspetta. Si può togliere COMPOSE_PROFILES=telegram e fermare il container.
 *
 * Avvio: `node workers/telegram.js`, con MONGODB_URI e NEXTAUTH_SECRET; la configurazione del bot
 * viene da Impostazioni → Telegram o dalle variabili TELEGRAM_*. Gli update vanno all'app
 * (TELEGRAM_RELAY_URL, default http://app:3000).
 */

import mongoose from 'mongoose';
import { runTelegramReceiver } from '../lib/telegramPolling.js';

const controller = new AbortController();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => controller.abort());

await mongoose.connect(process.env.MONGODB_URI);
console.log('[telegram] processo separato avviato: la ricezione è ora anche dentro l\'app, ne lavora uno solo');
await runTelegramReceiver({
  relayUrl: (process.env.TELEGRAM_RELAY_URL || 'http://app:3000').replace(/\/+$/, ''),
  signal: controller.signal,
  name: 'worker',
});
console.log('[telegram] arresto');
await mongoose.disconnect();
