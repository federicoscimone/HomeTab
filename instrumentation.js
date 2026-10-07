/**
 * @fileoverview Avvio del server: Next chiama register() una volta per processo, prima di
 * servire qualsiasi richiesta.
 *
 * Il seed della demo stava nel root layout: in DEMO_MODE ogni pagina faceva una query in più, e
 * due prime richieste parallele potevano trovare entrambe il database vuoto e ripopolarlo due
 * volte. Qui gira una sola volta, all'avvio.
 */

export async function register() {
  // Lo stesso file viene compilato anche per il runtime edge, dove Mongoose non esiste: i moduli
  // del database si importano solo nel runtime Node, e solo quando il server parte davvero.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.DEMO_MODE !== 'true') return;

  const { default: connectDB } = await import('./lib/mongodb.js');
  const { default: User } = await import('./lib/models/User.js');
  const { default: seedDemoMode } = await import('./lib/seed-demo-mode.js');
  const { DEMO_ACCOUNTS } = await import('./lib/demoAccounts.js');
  const { default: logger } = await import('./lib/logger.js');

  try {
    await connectDB();
    const seeded = await User.exists({ email: DEMO_ACCOUNTS[0].email });
    if (!seeded) await seedDemoMode();
  } catch (err) {
    // L'app deve partire comunque: senza dati demo le pagine funzionano, solo vuote.
    logger.error('Seed della demo all\'avvio non riuscito', { error: err.message });
  }
}
