import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import { aiAvailability } from '@/lib/ai';
import { loadAiSettings } from '@/lib/ai/settings';
import { buildRequests, buildWebRequests } from '@/lib/ai/tasks/categorize';
import { validRows } from '@/lib/ai/tasks/importRows';
import { serverTranslator } from '@/lib/i18n/server';

/**
 * Anteprima di «Suggerisci con l'IA»: le richieste esattamente come partirebbero, prodotte dalla
 * stessa funzione della chiamata vera, ma senza inviarle. Non costa nulla e funziona anche con
 * l'IA spenta: serve a provare il mascheramento sui propri estratti conto prima di usarla.
 */
export async function POST(req) {
  const { denied } = await requirePermission('movements:create');
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  // mode: 'web' mostra le richieste con ricerca web invece di quelle della categorizzazione.
  const web = body?.mode === 'web';
  const rows = validRows(body);
  if (!rows) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }

  await connectDB();
  const { system, schema, codes, groups, examples, batches } = web ? await buildWebRequests(rows) : await buildRequests(rows);
  const settings = await loadAiSettings();
  const availability = aiAvailability(web ? 'importWebSearch' : 'importCategorize', settings);
  const fallback = aiAvailability('importCategorizeFallback', settings);
  return NextResponse.json({
    model: availability.model,
    available: availability.available,
    web,
    fallbackModel: !web && fallback.available && fallback.model !== availability.model ? fallback.model : null,
    system,
    schema,
    categories: codes.list,
    examples,
    batches: batches.map((b) => ({
      prompt: b.prompt,
      maxTokens: b.maxTokens,
      ...(b.maxUses ? { maxSearches: b.maxUses } : {}),
      items: b.items.map((it) => ({ ...it, rowIds: groups.members.get(it.id) })),
    })),
  });
}
