/**
 * @fileoverview Processo del bot Telegram: completa il collegamento delle chat agli utenti.
 *
 * Avvio: `node workers/telegram.js`, con MONGODB_URI, TELEGRAM_BOT_TOKEN e TELEGRAM_BOT_USERNAME (nel compose è il servizio `telegram`, sotto il profilo
 * omonimo). Il server è dietro NAT e non riceve webhook, quindi il bot chiede lui i messaggi a
 * Telegram con getUpdates (long polling). Inviare i codici invece lo fa l'app: è una chiamata
 * in uscita. Uno solo di questi processi per bot: Telegram rifiuta due getUpdates in parallelo.
 *
 * Cosa gestisce: "/start <token>" collega la chat all'utente che ha generato il token dalla
 * pagina Account; qualunque altro messaggio riceve una breve spiegazione.
 */

import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import User from '../lib/models/User.js';
import TelegramLink from '../lib/models/TelegramLink.js';
import BotState from '../lib/models/BotState.js';
import { hashToken } from '../lib/utils/tokens.js';
import { botUsername, sendTelegramMessage, telegramCall, telegramConfigured } from '../lib/notify/telegram.js';
import { isLocale, DEFAULT_LOCALE } from '../lib/i18n/locale.js';

const POLL_SECONDS = 30;

/** Testi del bot dai messaggi dell'app: niente next-intl qui, quindi un'interpolazione minima. */
const MESSAGES = Object.fromEntries(['it', 'en'].map((locale) => [
  locale,
  JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).telegramBot,
]));
const text = (locale, key, vars = {}) =>
  MESSAGES[isLocale(locale) ? locale : DEFAULT_LOCALE][key].replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');

/** Lingua del messaggio quando l'utente non è ancora noto: quella del client Telegram, se c'è. */
const clientLocale = (message) => (message.from?.language_code?.startsWith('en') ? 'en' : DEFAULT_LOCALE);

/**
 * @param {object} message - Un messaggio del Bot API.
 */
async function handleMessage(message) {
  // Solo chat private: in un gruppo il chatId non identificherebbe una persona.
  if (message.chat?.type !== 'private' || typeof message.text !== 'string') return;
  const chatId = String(message.chat.id);
  const [command, token] = message.text.trim().split(/\s+/, 2);

  if (command !== '/start' || !token) {
    const user = await User.findOne({ telegramChatId: chatId }).select('locale').lean();
    await sendTelegramMessage(chatId, text(user?.locale ?? clientLocale(message), user ? 'alreadyLinked' : 'help'));
    return;
  }

  // Il token si consuma una volta sola, e solo se non è scaduto.
  const link = await TelegramLink.findOneAndDelete({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!link) {
    await sendTelegramMessage(chatId, text(clientLocale(message), 'invalidLink'));
    return;
  }

  // Una chat appartiene a un solo utente. Se è già di un altro, il collegamento si rifiuta:
  // spostarla toglierebbe all'altro, senza avvisarlo, il canale dei suoi codici.
  const owner = await User.findOne({ telegramChatId: chatId, _id: { $ne: link.userId } }).select('_id').lean();
  if (owner) {
    await sendTelegramMessage(chatId, text(clientLocale(message), 'chatTaken'));
    return;
  }

  const user = await User.findByIdAndUpdate(
    link.userId,
    { telegramChatId: chatId, telegramLinkedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!user) return;
  await sendTelegramMessage(chatId, text(user.locale ?? clientLocale(message), 'linked', { name: user.name }));
  console.log(`[telegram] chat collegata all'utente ${user._id}`);
}

async function run() {
  if (!telegramConfigured()) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN e TELEGRAM_BOT_USERNAME sono obbligatori');
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
          if (update.message) await handleMessage(update.message);
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
