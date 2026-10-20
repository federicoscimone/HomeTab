import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import logger from '@/lib/logger';
import { importMaxBytes } from '@/lib/demoAccounts';
import { aiAvailability, AiError } from '@/lib/ai';
import { loadAiSettings } from '@/lib/ai/settings';
import { microToUsd } from '@/lib/ai/pricing';
import { buildTemplateRequest, proposeTemplate } from '@/lib/ai/tasks/proposeTemplate';
import { readSheetRows } from '@/lib/utils/importParser';
import { requestLocale, serverTranslator } from '@/lib/i18n/server';

/**
 * Proposta di template per un estratto conto mai visto.
 *
 * `action=preview` restituisce la richiesta esattamente come partirebbe, senza inviarla: non
 * costa nulla e funziona anche con l'IA spenta. `action=propose` la invia, e prova la proposta
 * con il parser vero su tutto il file. In entrambi i casi il file resta sul server.
 */
export async function POST(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const tErrors = await serverTranslator('errors');

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  const action = formData?.get('action') === 'propose' ? 'propose' : 'preview';
  if (!file || typeof file.arrayBuffer !== 'function' || file.size === 0) {
    return NextResponse.json({ error: tErrors('noDataProvided') }, { status: 400 });
  }
  const maxBytes = importMaxBytes();
  if (file.size > maxBytes) {
    return NextResponse.json({ error: tErrors('fileTooLarge', { mb: Math.round(maxBytes / 1024 / 1024) }) }, { status: 413 });
  }

  const fileType = /\.csv$/i.test(file.name || '') ? 'csv' : 'xlsx';
  const buffer = Buffer.from(await file.arrayBuffer());
  let rows;
  try {
    rows = readSheetRows(buffer, fileType === 'csv');
  } catch {
    return NextResponse.json({ error: tErrors('templateFileUnreadable') }, { status: 400 });
  }
  const request = buildTemplateRequest(rows, fileType, await requestLocale());
  if (request.error) return NextResponse.json({ error: tErrors('templateNoDataRows') }, { status: 400 });

  await connectDB();
  const availability = aiAvailability('importTemplate', await loadAiSettings());

  if (action === 'preview') {
    return NextResponse.json({
      available: availability.available,
      model: availability.model,
      system: request.system,
      sent: request.sent,
      originalRows: [request.location.headerIndex, ...request.location.dataIndexes]
        .filter((i) => i !== null)
        // L'originale torna solo a chi ha caricato il file, per il confronto: non va al modello.
        .map((i) => rows[i].slice(0, request.sent.columns.length).map((c) => String(c ?? ''))),
    });
  }

  if (!availability.available) {
    return NextResponse.json({ error: tErrors('aiUnavailable') }, { status: 409 });
  }
  const fallbackName = (file.name || '').replace(/\.[^.]+$/, '').slice(0, 60) || 'Template';
  try {
    const result = await proposeTemplate({
      buffer, rows, request, fileType, fallbackName, userId: session.user.id,
    });
    logger.info('POST /api/impostazioni/template-import/suggest', {
      parsed: result.check.parsed, dataRows: result.check.dataRows, costMicro: result.costMicro, model: result.model,
    });
    return NextResponse.json({ ...result, costUsd: microToUsd(result.costMicro) });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    const key = err.code === 'budget' ? 'aiBudgetReached' : 'aiFailed';
    return NextResponse.json({ error: tErrors(key) }, { status: err.code === 'budget' ? 402 : 502 });
  }
}
