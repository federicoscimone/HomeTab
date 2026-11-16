/**
 * @fileoverview Ricezione dei messaggi del bot Telegram, dentro l'app.
 * @module lib/telegramPolling
 *
 * Un ciclo che rilegge la configurazione (lib/services/telegramSettings.js) e si adegua da solo,
 * senza riavvii né container in più:
 * - polling (rete di casa, nessuna porta aperta): long polling con getUpdates. Telegram risponde
 *   appena arriva un messaggio, quindi non c'è ritardo; ogni update va alla rotta
 *   /api/telegram/webhook con il token di relayToken(), la stessa logica del webhook;
 * - webhook (istanza pubblica): registra il webhook quando la configurazione cambia;
 * - bot non configurato: aspetta e ricontrolla.
 *
 * Telegram rifiuta due getUpdates in parallelo sullo stesso bot: lavora solo chi tiene il
 * lucchetto su Mongo (BotState 'receiver'), rinnovato a ogni giro. Così possono convivere l'app e il
 * vecchio processo workers/telegram.js, che usa questo stesso codice.
 *
 * Solo import relativi: lo usa anche workers/telegram.js, fuori da Next.
 */

import crypto from 'crypto';
import os from 'os';
import BotState from './models/BotState.js';
import { telegramCall } from './notify/telegram.js';
import { ALLOWED_UPDATES, ensureWebhook, relayToken } from './telegramBot.js';
import { loadTelegramSettings } from './services/telegramSettings.js';

const POLL_SECONDS = 20;
const IDLE_MS = 10_000;
const RETRY_MS = 5_000;
// Il lucchetto non si rilascia allo spegnimento: Next chiama process.exit() appena riceve SIGTERM,
// e una scrittura su Mongo non farebbe in tempo. Dura poco, quindi, e si rinnova a ogni giro e
// prima di ogni consegna: dopo una ridistribuzione il processo nuovo riceve entro 30 secondi.
// Nel frattempo i messaggi restano in coda su Telegram, nessuno si perde.
const LEASE_MS = 30_000;
const RECEIVER = 'receiver';

/** Attesa interrompibile: allo spegnimento il ciclo esce subito. */
const sleep = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

const fingerprint = (value) => crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 12);

/**
 * Prende o rinnova il lucchetto. Libero se scaduto o già nostro.
 * @returns {Promise<boolean>}
 */
async function acquire(owner) {
  const now = new Date();
  try {
    const doc = await BotState.findOneAndUpdate(
      { _id: RECEIVER, $or: [{ leaseOwner: owner }, { leaseUntil: { $lt: now } }, { leaseUntil: null }] },
      { $set: { leaseOwner: owner, leaseUntil: new Date(now.getTime() + LEASE_MS) } },
      { upsert: true, returnDocument: 'after' },
    );
    return doc?.leaseOwner === owner;
  } catch (err) {
    // Un altro processo ha il lucchetto valido: l'upsert prova a creare il documento e trova l'_id.
    if (err?.code === 11000) return false;
    throw err;
  }
}

const release = (owner) =>
  BotState.updateOne({ _id: RECEIVER, leaseOwner: owner }, { $set: { leaseUntil: null } }).catch(() => {});

const status = (fields) => BotState.updateOne({ _id: RECEIVER }, { $set: fields }).catch(() => {});

/**
 * L'indirizzo a cui consegnare gli update. Nel container il server di Next ascolta sull'HOSTNAME
 * che Docker assegna (l'id del container), non su 127.0.0.1.
 */
export function defaultRelayUrl(env = process.env) {
  if (env.TELEGRAM_RELAY_URL) return env.TELEGRAM_RELAY_URL.replace(/\/+$/, '');
  const host = !env.HOSTNAME || env.HOSTNAME === '0.0.0.0' ? '127.0.0.1' : env.HOSTNAME;
  return `http://${host}:${env.PORT || 3000}`;
}

/** Consegna un update all'app; lancia un errore se l'app non l'ha accettato. */
async function relay(relayUrl, update, signal) {
  const res = await fetch(`${relayUrl}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HomeTab-Relay': relayToken() },
    body: JSON.stringify(update),
    signal,
  });
  if (!res.ok) throw new Error(`l'app ha risposto ${res.status}`);
}

/**
 * Il ciclo di ricezione. Non termina finché `signal` non viene interrotto.
 *
 * @param {{ relayUrl?: string, signal?: AbortSignal, log?: { info: Function, error: Function },
 *   name?: string }} [options] - name: chi riceve, per il lucchetto e i log.
 */
export async function runTelegramReceiver({ relayUrl = defaultRelayUrl(), signal, log = console, name = 'app' } = {}) {
  if (!relayToken()) throw new Error('NEXTAUTH_SECRET mancante: serve a firmare gli update consegnati all\'app');
  const owner = `${name}@${os.hostname()}:${process.pid}`;
  let active = null;   // la configurazione già messa in opera (modo, bot, token, segreto)

  while (!signal?.aborted) {
    try {
      const cfg = await loadTelegramSettings();
      if (!cfg.token || !cfg.username) {
        if (active) { await release(owner); active = null; }
        await sleep(IDLE_MS, signal);
        continue;
      }
      if (!(await acquire(owner))) {
        active = null;
        await sleep(IDLE_MS, signal);
        continue;
      }

      const key = [cfg.mode, cfg.username, fingerprint(cfg.token), fingerprint(cfg.webhookSecret)].join(':');
      if (cfg.mode === 'webhook') {
        if (key !== active) {
          const result = await ensureWebhook();
          log.info(`[telegram] webhook di @${cfg.username} ${result === 'set' ? 'registrato' : 'già registrato'}`);
          active = key;
          await status({ bot: cfg.username, mode: 'webhook', lastContactAt: new Date(), lastError: null });
        }
        await sleep(IDLE_MS, signal);
        continue;
      }

      if (key !== active) {
        // Con un webhook attivo getUpdates è rifiutato: si toglie, senza perdere i messaggi in coda.
        await telegramCall('deleteWebhook', { drop_pending_updates: false });
        log.info(`[telegram] in ascolto come @${cfg.username}`);
        active = key;
      }
      const state = await BotState.findById(cfg.username).lean();
      const updates = await telegramCall(
        'getUpdates',
        { offset: state?.offset ?? 0, timeout: POLL_SECONDS, allowed_updates: ALLOWED_UPDATES },
        { signal },
      );
      await status({ bot: cfg.username, mode: 'polling', lastContactAt: new Date(), lastError: null });
      for (const update of updates) {
        // Una consegna può durare (uno scontrino letto dall'IA): il lucchetto si rinnova prima.
        if (!(await acquire(owner))) { active = null; break; }
        // L'offset avanza solo dopo la consegna: se l'app non risponde, l'update si riprova.
        await relay(relayUrl, update, signal);
        await BotState.updateOne({ _id: cfg.username }, { offset: update.update_id + 1 }, { upsert: true });
      }
    } catch (err) {
      if (signal?.aborted) break;
      // Il messaggio può contenere l'URL del Bot API, cioè il token: si scrive solo la descrizione.
      const message = String(err?.message ?? err).replace(/bot\d+:[\w-]+/g, 'bot***');
      log.error(`[telegram] ricezione non riuscita, nuovo tentativo tra ${RETRY_MS / 1000} s: ${message}`);
      await status({ lastError: message.slice(0, 300) });
      active = null;
      await sleep(RETRY_MS, signal);
    }
  }
  await release(owner);
}
