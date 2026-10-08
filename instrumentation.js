/**
 * @fileoverview Avvio del server: Next chiama register() una volta per processo, prima di
 * servire qualsiasi richiesta.
 *
 * Il seed della demo stava nel root layout: in DEMO_MODE ogni pagina faceva una query in più, e
 * due prime richieste parallele potevano trovare entrambe il database vuoto e ripopolarlo due
 * volte. Qui gira all'avvio, con un lucchetto su Mongo perché su Vercel più istanze possono
 * partire insieme (lib/demoLock.js).
 *
 * Il seed parte solo su un database senza utenti. Prima bastava che mancasse l'account demo:
 * un'installazione con dati veri avviata per errore con DEMO_MODE=true sarebbe stata svuotata.
 */

export async function register() {
  // Lo stesso file viene compilato anche per il runtime edge, dove Mongoose non esiste: i moduli
  // del database si importano solo nel runtime Node, e solo quando il server parte davvero.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  // Webhook di Telegram: si registra da solo, solo se manca o è cambiato (lib/telegramBot.js).
  // Senza await: una risposta lenta di Telegram non deve ritardare l'avvio dell'app.
  if (process.env.TELEGRAM_WEBHOOK_SECRET && process.env.TELEGRAM_BOT_TOKEN) {
    Promise.all([import('./lib/telegramBot.js'), import('./lib/logger.js')])
      .then(async ([{ ensureWebhook }, { default: logger }]) => {
        try {
          const result = await ensureWebhook();
          if (result === 'set') logger.info('Webhook di Telegram registrato');
        } catch (err) {
          logger.error('Registrazione del webhook di Telegram non riuscita', { error: err.message });
        }
      });
  }

  if (process.env.DEMO_MODE !== 'true') return;

  const { default: connectDB } = await import('./lib/mongodb.js');
  const { default: User } = await import('./lib/models/User.js');
  const { default: seedDemoMode } = await import('./lib/seed-demo-mode.js');
  const { withDemoLock } = await import('./lib/demoLock.js');
  const { default: logger } = await import('./lib/logger.js');

  try {
    await connectDB();
    if (await User.exists({})) return;
    await withDemoLock(async () => {
      // Ricontrollo con il lucchetto preso: un'altra istanza può aver appena finito.
      if (!(await User.exists({}))) await seedDemoMode();
    });
  } catch (err) {
    // L'app deve partire comunque: senza dati demo le pagine funzionano, solo vuote.
    logger.error('Seed della demo all\'avvio non riuscito', { error: err.message });
  }
}
