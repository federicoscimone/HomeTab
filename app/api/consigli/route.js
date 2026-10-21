/**
 * @fileoverview API route — /api/consigli
 * POST — consigli di risparmio, solo su richiesta: nessun riepilogo parte da solo.
 *
 * Il codice calcola i segnali (lib/services/insights.js). Con l'IA disponibile il modello ne
 * sceglie al massimo tre e li spiega (lib/ai/tasks/advice.js); senza, o se la chiamata fallisce,
 * restano i tre più pesanti senza spiegazione, e la risposta dice perché.
 *
 * Risposta: { advice: [{ ...segnale, text }], ai, reason, costUsd, total, hiddenCount, istatYear }
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import logger from '@/lib/logger';
import { aiAvailability, AiError, runStructured } from '@/lib/ai';
import { loadAiSettings } from '@/lib/ai/settings';
import { microToUsd } from '@/lib/ai/pricing';
import { buildAdviceRequest, MAX_ADVICE, readAdvice, signalView } from '@/lib/ai/tasks/advice';
import { loadSignals, MAX_FOR_MODEL, rankSignals } from '@/lib/services/insights';
import { requestLocale, serverTranslator } from '@/lib/i18n/server';

const MAX_TOKENS = 1_500;

/** Ciò che la pagina mostra di un segnale: senza la riga di esempio, che serve solo al modello. */
const publicSignal = ({ sampleRow, ...s }) => s;

export async function POST() {
  const { session, denied } = await requirePermission('data:read');
  if (denied) return denied;
  await connectDB();

  const { signals, hiddenCount, istatYear, feedback } = await loadSignals();
  const base = { total: signals.length, hiddenCount, istatYear };
  const fallback = (reason) => NextResponse.json({
    ...base,
    advice: rankSignals(signals, { perKind: 2, limit: MAX_ADVICE }).map((s) => ({ ...publicSignal(s), text: null })),
    ai: false,
    reason,
    costUsd: 0,
  });
  if (signals.length === 0) return NextResponse.json({ ...base, advice: [], ai: false, reason: null, costUsd: 0 });

  const { available, reason } = aiAvailability('advice', await loadAiSettings());
  if (!available) return fallback(reason);

  const locale = await requestLocale();
  const tIstat = await serverTranslator('istat');
  const candidates = rankSignals(signals, { perKind: 4, limit: MAX_FOR_MODEL });
  const views = candidates.map((s) => signalView(s, { locale, division: (code) => tIstat(`divisions.d${code}`) }));
  const { system, prompt, schema } = buildAdviceRequest(views, { locale, feedback });
  try {
    const res = await runStructured({ task: 'advice', system, prompt, schema, maxTokens: MAX_TOKENS, userId: session.user.id });
    const byKey = new Map(candidates.map((s) => [s.key, s]));
    const chosen = readAdvice(res.data, views);
    const advice = chosen.map((a) => ({ ...publicSignal(byKey.get(a.id)), text: a.text }));
    // Solo i numeri rifiutati, non il testo: bastano a capire se la verifica è troppo severa.
    const rejected = chosen.filter((a) => a.rejected).map((a) => ({ kind: byKey.get(a.id).kind, numbers: a.rejected }));
    logger.info('POST /api/consigli', {
      signals: signals.length, chosen: advice.length, rejected, costMicro: res.costMicro, userId: session.user.id,
    });
    return NextResponse.json({ ...base, advice, ai: true, reason: null, costUsd: microToUsd(res.costMicro), model: res.model });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return fallback(err.code);
  }
}
