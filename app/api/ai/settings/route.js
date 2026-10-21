import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import { isDemoMode } from '@/lib/demoAccounts';
import connectDB from '@/lib/mongodb';
import AiSettings from '@/lib/models/AiSettings';
import AiUsage from '@/lib/models/AiUsage';
import { writeAudit } from '@/lib/utils/audit';
import { serverTranslator } from '@/lib/i18n/server';
import { aiAvailability } from '@/lib/ai';
import { monthSpending, capMicro } from '@/lib/ai/budget';
import { microToUsd, PRICES } from '@/lib/ai/pricing';
import { providerCatalog } from '@/lib/ai/providers';
import { EFFORTS, loadAiSettings, providerKey, resolveAiSettings } from '@/lib/ai/settings';
import { aiSettingsInput, MAX_BUDGET_USD } from '@/lib/ai/settingsInput';

/** Etichette dei campi per la descrizione dell'audit log (registrata in italiano, come le altre). */
const CHANGE_LABELS = {
  importModel: 'modello per l\'import',
  importFallbackModel: 'modello di riserva per l\'import',
  importEffort: 'effort per l\'import',
  monthlyBudgetUsd: 'tetto mensile',
  importAutoSuggest: 'suggerimenti automatici nell\'import',
  importWebSearch: 'ricerca web degli esercenti',
  chatModel: 'modello della chat',
  chatEffort: 'effort della chat',
  'anthropicApiKey:replaced': 'chiave Anthropic sostituita',
  'anthropicApiKey:removed': 'chiave Anthropic eliminata',
};

/** Tutto ciò che serve alla pagina. La chiave non c'è mai: solo se esiste, da dove viene e le ultime 4 cifre. */
async function settingsView() {
  const doc = await loadAiSettings();
  const settings = resolveAiSettings(doc);
  const { month, spentMicro } = await monthSpending();
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const [byOutcome, recent] = await Promise.all([
    AiUsage.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: '$outcome', calls: { $sum: 1 } } },
    ]),
    AiUsage.find().sort({ createdAt: -1 }).limit(10)
      .select('task model outcome inputTokens outputTokens cacheReadTokens costMicro durationMs createdAt')
      .lean(),
  ]);
  const { source, hint, unreadable } = providerKey('anthropic', doc);

  return {
    demo: isDemoMode(),
    settings: {
      importModel: settings.importModel,
      importFallbackModel: settings.importFallbackModel,
      importEffort: settings.importEffort,
      monthlyBudgetUsd: settings.monthlyBudgetUsd,
      importAutoSuggest: settings.importAutoSuggest,
      importWebSearch: settings.importWebSearch,
      chatModel: settings.chatModel,
      chatEffort: settings.chatEffort,
    },
    keys: { anthropic: { configured: Boolean(source), source, hint, unreadable } },
    catalog: providerCatalog().map((p) => ({
      ...p,
      models: p.models.map((m) => ({ id: `${p.id}:${m}`, input: PRICES[m]?.input, output: PRICES[m]?.output })),
    })),
    efforts: EFFORTS,
    maxBudgetUsd: MAX_BUDGET_USD,
    import: (({ available, reason, model }) => ({ available, reason, model }))(aiAvailability('importCategorize', doc)),
    chat: (({ available, reason, model }) => ({ available, reason, model }))(aiAvailability('chat', doc)),
    month,
    spentUsd: microToUsd(spentMicro),
    capUsd: microToUsd(capMicro(settings.monthlyBudgetUsd.value)),
    calls: Object.fromEntries(byOutcome.map((o) => [o._id, o.calls])),
    recent: recent.map(({ _id, costMicro, ...r }) => ({ id: String(_id), ...r, costUsd: microToUsd(costMicro) })),
  };
}

export async function GET() {
  const { denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  await connectDB();
  return NextResponse.json(await settingsView());
}

/** Salva le impostazioni. Nella demo è bloccato: l'account demo è amministratore e pubblico. */
export async function PUT(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  const input = aiSettingsInput(await req.json().catch(() => null));
  if (input.error) {
    return NextResponse.json({ error: (await serverTranslator('errors'))(input.error) }, { status: 400 });
  }

  await connectDB();
  const update = { $set: { ...input.set, updatedBy: session.user.id } };
  if (Object.keys(input.unset).length) update.$unset = input.unset;
  await AiSettings.updateOne({ _id: 'ai' }, update, { upsert: true });

  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'system',
    resourceId: 'ai',
    description: `Impostazioni IA aggiornate: ${input.changes.map((c) => CHANGE_LABELS[c]).join(', ')}`,
    meta: { changes: input.changes },
  });
  return NextResponse.json(await settingsView());
}
