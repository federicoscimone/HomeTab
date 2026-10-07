/**
 * @fileoverview API route — /api/demo/reset
 * GET — riporta la demo ai dati iniziali. La chiama il cron notturno di Vercel (vercel.json).
 *
 * La demo è aperta a chiunque e l'account demo è amministratore: i visitatori possono cancellare
 * movimenti o creare utenti. Questa rotta rigenera i 24 mesi di dati fittizi.
 *
 * Tre condizioni, tutte necessarie: DEMO_MODE=true, il segreto CRON_SECRET nell'header
 * Authorization (come lo manda Vercel), e la presenza dell'account demo nel database. L'ultima
 * impedisce di svuotare un database con dati veri anche se le prime due fossero sbagliate.
 */

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import seedDemoMode from '@/lib/seed-demo-mode';
import { withDemoLock } from '@/lib/demoLock';
import { DEMO_ACCOUNTS, isDemoMode } from '@/lib/demoAccounts';
import { bearerToken, secretMatches } from '@/lib/utils/secrets';
import logger from '@/lib/logger';

// Il seed inserisce circa 800 movimenti: qualche secondo, oltre il limite predefinito di alcune piattaforme.
export const maxDuration = 60;

export async function GET(req) {
  if (!isDemoMode()) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
  if (!secretMatches(bearerToken(req), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  await connectDB();

  // Il controllo sull'account demo sta dentro il lucchetto: durante un ripristino gli utenti sono
  // momentaneamente cancellati, e una seconda chiamata in quel momento li troverebbe assenti.
  let notADemo = false;
  const { ran } = await withDemoLock(async () => {
    if (!(await User.exists({ email: DEMO_ACCOUNTS[0].email }))) {
      notADemo = true;
      return;
    }
    await seedDemoMode();
  });

  if (notADemo) {
    logger.warn('Ripristino demo rifiutato: il database non contiene l\'account demo');
    return NextResponse.json({ error: 'Il database non è una demo: ripristino rifiutato' }, { status: 409 });
  }
  logger.info(ran ? 'Demo ripristinata' : 'Ripristino demo già in corso altrove');
  return NextResponse.json({ reset: ran });
}
