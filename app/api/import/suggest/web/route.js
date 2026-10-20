import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import logger from '@/lib/logger';
import { aiAvailability } from '@/lib/ai';
import { loadAiSettings } from '@/lib/ai/settings';
import { microToUsd } from '@/lib/ai/pricing';
import { suggestFromWeb } from '@/lib/ai/tasks/categorize';
import { validRows } from '@/lib/ai/tasks/importRows';
import { serverTranslator } from '@/lib/i18n/server';

/**
 * Cerca sul web gli esercenti che parole chiave, storico, banca e IA non hanno riconosciuto.
 * Parte solo dal pulsante «Cerca sul web»: costa circa un centesimo a riga, e al motore di ricerca
 * arrivano nome e luogo dell'attività, già mascherati come tutto il resto.
 */
export async function POST(req) {
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;

  const rows = validRows(await req.json().catch(() => null));
  if (!rows) return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });

  await connectDB();
  const availability = aiAvailability('importWebSearch', await loadAiSettings());
  if (!availability.available) {
    return NextResponse.json({ available: false, reason: availability.reason, suggestions: [] });
  }

  const result = await suggestFromWeb(rows, { userId: session.user.id });
  logger.info('POST /api/import/suggest/web', {
    rows: rows.length, suggestions: result.suggestions.length, searches: result.searches,
    costMicro: result.costMicro, model: result.model, userId: session.user.id,
  });
  return NextResponse.json({
    available: true,
    suggestions: result.suggestions,
    costUsd: microToUsd(result.costMicro),
    searches: result.searches,
    model: result.model,
    failedBatches: result.failedBatches,
    error: result.error,
    skipped: result.skipped,
  });
}
