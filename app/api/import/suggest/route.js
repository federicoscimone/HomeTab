import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import logger from '@/lib/logger';
import { aiAvailability } from '@/lib/ai';
import { loadAiSettings } from '@/lib/ai/settings';
import { microToUsd } from '@/lib/ai/pricing';
import { suggestCategories } from '@/lib/ai/tasks/categorize';
import { serverTranslator } from '@/lib/i18n/server';
import { validRows } from '@/lib/ai/tasks/importRows';

/**
 * Suggerimenti dell'IA per le righe dell'import senza categoria.
 * L'import non dipende da questa rotta: se l'IA è spenta, a tetto pieno o in errore, la revisione
 * prosegue con le sole parole chiave.
 */
export async function POST(req) {
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;

  const rows = validRows(await req.json().catch(() => null));
  if (!rows) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }

  await connectDB();
  const availability = aiAvailability('importCategorize', await loadAiSettings());
  if (!availability.available) {
    return NextResponse.json({ available: false, reason: availability.reason, suggestions: [] });
  }

  const result = await suggestCategories(rows, { userId: session.user.id });
  logger.info('POST /api/import/suggest', {
    rows: rows.length, suggestions: result.suggestions.length, failedBatches: result.failedBatches,
    costMicro: result.costMicro, model: result.model, userId: session.user.id,
  });
  return NextResponse.json({
    available: true,
    suggestions: result.suggestions,
    costUsd: microToUsd(result.costMicro),
    model: result.model,
    failedBatches: result.failedBatches,
    error: result.error,
  });
}
