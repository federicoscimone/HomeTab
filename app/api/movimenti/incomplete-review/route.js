import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import { aiAvailability } from '@/lib/ai';
import { loadAiSettings, resolveAiSettings } from '@/lib/ai/settings';
import { localSuggester } from '@/lib/services/localCategorize';
import { webAvailability } from '@/lib/ai/webAvailability';

/** Movimenti per revisione: i più recenti; gli altri arrivano alla revisione successiva. */
const LIMIT = 300;

/**
 * I movimenti senza categoria, ciascuno con la categoria proposta in locale (parole chiave,
 * storico, categoria della banca). Non modifica nulla: le categorie si applicano solo con
 * POST /api/movimenti/apply-categories, dopo la conferma dell'utente.
 */
export async function GET() {
  const { denied } = await requirePermission('movements:edit');
  if (denied) return denied;
  await connectDB();

  const [total, movements, aiDoc] = await Promise.all([
    Movement.countDocuments({ categoryId: null }),
    Movement.find({ categoryId: null })
      .sort({ date: -1, _id: -1 })
      .limit(LIMIT)
      .select('date amount type description payee place bankCategory paymentMethod')
      .lean(),
    loadAiSettings(),
  ]);
  const suggest = movements.length ? await localSuggester({ withBank: movements.some((m) => m.bankCategory) }) : null;
  const ai = aiAvailability('importCategorize', aiDoc);

  return NextResponse.json({
    total,
    movements: movements.map((m) => ({
      id: String(m._id),
      date: m.date, amount: m.amount, type: m.type, paymentMethod: m.paymentMethod,
      description: m.description || '', payee: m.payee || '', place: m.place || '', bankCategory: m.bankCategory || '',
      suggestion: suggest ? suggest(m) : null,
    })),
    aiAvailable: ai.available,
    aiAutoSuggest: ai.available && resolveAiSettings(aiDoc).importAutoSuggest.value === true,
    ...webAvailability(aiDoc),
  });
}
