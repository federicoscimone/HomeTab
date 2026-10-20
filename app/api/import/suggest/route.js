import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import logger from '@/lib/logger';
import { aiAvailability } from '@/lib/ai';
import { loadAiSettings } from '@/lib/ai/settings';
import { microToUsd } from '@/lib/ai/pricing';
import { suggestCategories } from '@/lib/ai/tasks/categorize';
import { serverTranslator } from '@/lib/i18n/server';

/** Righe al massimo per richiesta: un estratto conto mensile ne ha qualche centinaio. */
const MAX_ROWS = 1000;
const TEXT_MAX = 300;

/** Solo i campi che servono, come stringhe corte: il resto della riga non lascia il server. */
function cleanRow(r) {
  const s = (v) => (typeof v === 'string' ? v.slice(0, TEXT_MAX) : '');
  return {
    id: r.id,
    description: s(r.description),
    payee: s(r.payee),
    place: s(r.place),
    type: r.type === 'income' ? 'income' : 'expense',
    amount: Number.isFinite(r.amount) ? r.amount : 0,
  };
}

/**
 * Suggerimenti dell'IA per le righe dell'import senza categoria.
 * L'import non dipende da questa rotta: se l'IA è spenta, a tetto pieno o in errore, la revisione
 * prosegue con le sole parole chiave.
 */
export async function POST(req) {
  const { session, denied } = await requirePermission('movements:create');
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length === 0 || rows.length > MAX_ROWS || rows.some((r) => !Number.isInteger(r?.id))) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }

  await connectDB();
  const availability = aiAvailability('importCategorize', await loadAiSettings());
  if (!availability.available) {
    return NextResponse.json({ available: false, reason: availability.reason, suggestions: [] });
  }

  const result = await suggestCategories(rows.map(cleanRow), { userId: session.user.id });
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
