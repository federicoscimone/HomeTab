/**
 * @fileoverview API route — /api/impostazioni/confronto-istat/suggest
 * POST — il modello propone il capitolo ISTAT delle categorie che non ne hanno uno. Non salva
 * nulla: le proposte tornano alla pagina, che le mostra da controllare. Vedi
 * lib/ai/tasks/coicopMapping.js.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Category from '@/lib/models/Category';
import { aiAvailability, AiError, runStructured } from '@/lib/ai';
import { loadAiSettings } from '@/lib/ai/settings';
import { microToUsd } from '@/lib/ai/pricing';
import { buildMappingRequest, readMapping } from '@/lib/ai/tasks/coicopMapping';
import { serverTranslator } from '@/lib/i18n/server';

/** Uscita: una base per il ragionamento più una riga di risposta per ogni categoria da assegnare. */
const maxTokensFor = (toAssign) => 1_500 + toAssign * 60;

export async function POST() {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  await connectDB();

  const { available, reason } = aiAvailability('istatMapping', await loadAiSettings());
  const tErr = await serverTranslator('errors');
  if (!available) return NextResponse.json({ error: tErr('aiUnavailable'), reason }, { status: 409 });

  const categories = await Category.find({ level: { $in: [1, 2] } }).sort({ level: 1, order: 1, name: 1 })
    .select('name level parentId coicop').lean();
  const { system, prompt, schema, codes, toAssign } = buildMappingRequest(categories);
  if (toAssign === 0) return NextResponse.json({ proposals: {}, costUsd: 0, toAssign });

  try {
    const res = await runStructured({ task: 'istatMapping', system, prompt, schema, maxTokens: maxTokensFor(toAssign), userId: session.user.id });
    return NextResponse.json({ proposals: readMapping(res.data, codes), costUsd: microToUsd(res.costMicro), toAssign });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    return NextResponse.json({ error: tErr('aiUnavailable'), reason: err.code }, { status: err.code === 'budget' ? 429 : 502 });
  }
}
