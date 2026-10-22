import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import connectDB from '@/lib/mongodb';
import { AiError } from '@/lib/ai';
import { microToUsd } from '@/lib/ai/pricing';
import { serverTranslator } from '@/lib/i18n/server';
import { checkPrices } from '@/lib/services/prices';

/** Errori dell'IA → messaggio per l'utente: senza modello le pagine non si leggono. */
const AI_ERRORS = { unavailable: 'aiUnavailable', budget: 'aiBudgetReached', failed: 'aiFailed', invalid: 'aiFailed' };

/**
 * «Aggiorna i prezzi», primo passo: rilegge le pagine ufficiali e restituisce le differenze, già
 * verificate sul testo delle pagine. Non cambia ancora nessun prezzo.
 */
export async function POST() {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  await connectDB();
  try {
    const { costMicro, ...result } = await checkPrices(session.user.id);
    return NextResponse.json({ ...result, costUsd: microToUsd(costMicro) });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return NextResponse.json({ error: (await serverTranslator('errors'))(AI_ERRORS[err.code] ?? 'aiFailed') }, { status: 409 });
  }
}
