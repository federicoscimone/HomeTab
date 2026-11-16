/**
 * @fileoverview Avvio del bot Telegram all'avvio del server (instrumentation.js), solo nel runtime
 * Node: in un modulo a parte, importato dopo il controllo del runtime, così la versione Edge di
 * instrumentation non trascina moduli Node (crypto, os) che lì non esistono.
 * @module lib/telegramStart
 */

/** Avvia la ricezione dei messaggi del bot, una sola volta per processo. */
export async function startTelegram(logger) {
  const STARTED = Symbol.for('hometab.telegram.receiver');
  if (globalThis[STARTED]) return;
  globalThis[STARTED] = true;

  const [{ default: connectDB }, { loadTelegramSettings }, { ensureWebhook }, { runTelegramReceiver }] = await Promise.all([
    import('./mongodb.js'),
    import('./services/telegramSettings.js'),
    import('./telegramBot.js'),
    import('./telegramPolling.js'),
  ]);
  await connectDB();
  const cfg = await loadTelegramSettings({ force: true });

  if (process.env.VERCEL) {
    if (cfg.token && cfg.mode === 'webhook') {
      const result = await ensureWebhook();
      if (result === 'set') logger.info('Webhook di Telegram registrato');
    }
    return;
  }
  const log = { info: (m) => logger.info(m), error: (m) => logger.error(m) };
  runTelegramReceiver({ log }).catch((err) => logger.error('Ricezione Telegram interrotta', { error: err.message }));
}
