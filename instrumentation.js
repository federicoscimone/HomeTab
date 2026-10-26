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

/** Segreti scritti nel repository: .env.example e lo stage di build del Dockerfile. */
const PLACEHOLDER_SECRETS = ['change-me', 'build-time-placeholder-secret'];

export async function register() {
  // Lo stesso file viene compilato anche per il runtime edge, dove Mongoose non esiste: i moduli
  // del database si importano solo nel runtime Node, e solo quando il server parte davvero.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  // NEXTAUTH_SECRET firma i cookie di sessione e cifra le chiavi salvate nel database. Con il
  // valore d'esempio di .env.example, scritto in un repository pubblico, chiunque potrebbe
  // firmarsi una sessione: con dati veri l'app non parte. La demo sì, i dati sono fittizi.
  if (process.env.DEMO_MODE !== 'true' && PLACEHOLDER_SECRETS.includes(process.env.NEXTAUTH_SECRET)) {
    throw new Error('NEXTAUTH_SECRET è ancora il valore d\'esempio: generane uno con `openssl rand -hex 32` o `npm run setup`');
  }

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
