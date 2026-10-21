import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import logger from '@/lib/logger';
import { aiAvailability, AiError } from '@/lib/ai';
import { loadAiSettings } from '@/lib/ai/settings';
import { microToUsd } from '@/lib/ai/pricing';
import { MAX_HISTORY, MAX_QUESTION, runAgent } from '@/lib/ai/agent/run';
import { requestLocale, serverTranslator } from '@/lib/i18n/server';

/** Lunghezza massima di un turno precedente: lo storico serve al contesto, non a rimandare testi lunghi. */
const MAX_HISTORY_TEXT = 2_000;

function validHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string' && h.text.trim())
    .slice(-MAX_HISTORY)
    .map((h) => ({ role: h.role, text: h.text.slice(0, MAX_HISTORY_TEXT) }));
}

/** Se la chat è disponibile, per la pagina: senza dettagli sulla configurazione. */
export async function GET() {
  const { denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();
  const { available, reason } = aiAvailability('chat', await loadAiSettings());
  return NextResponse.json({ available, reason });
}

/**
 * La chat sui dati. Risponde in streaming con una riga JSON per evento:
 * - { type: 'tool', name, args }  uno strumento in esecuzione;
 * - { type: 'text', delta }       un pezzo di risposta; { type: 'reset' } scarta il testo scritto
 *                                 prima di uno strumento;
 * - { type: 'done', costUsd, model, tools } oppure { type: 'error', code }.
 *
 * Sola lettura: l'agente usa i permessi dell'utente in sessione e nessuno strumento modifica nulla.
 * Le conversazioni non si salvano: lo storico breve lo tiene il browser e lo rimanda a ogni domanda.
 */
export async function POST(req) {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > MAX_QUESTION) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('invalidData') }, { status: 400 });
  }

  await connectDB();
  const availability = aiAvailability('chat', await loadAiSettings());
  if (!availability.available) {
    return NextResponse.json({ error: (await serverTranslator('errors'))('aiUnavailable'), reason: availability.reason }, { status: 409 });
  }

  const locale = await requestLocale();
  const uncategorized = (await serverTranslator('reports'))('uncategorized');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const result = await runAgent({
          question, history: validHistory(body.history), locale, uncategorized, userId: session.user.id, emit,
        });
        logger.info('POST /api/chat', {
          steps: result.steps, tools: result.tools, costMicro: result.costMicro, model: result.model,
          exhausted: Boolean(result.exhausted), userId: session.user.id,
        });
        if (result.exhausted) emit({ type: 'error', code: 'tooManySteps' });
        else emit({ type: 'done', costUsd: microToUsd(result.costMicro), model: result.model, tools: result.tools });
      } catch (err) {
        emit({ type: 'error', code: err instanceof AiError ? err.code : 'failed' });
        if (!(err instanceof AiError)) logger.error('POST /api/chat', { message: err?.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
