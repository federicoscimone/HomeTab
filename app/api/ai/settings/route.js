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
import { currentRates, microToUsd } from '@/lib/ai/pricing';
import { CLOUD_PROVIDERS, ollamaModels, providerById, providerCatalog } from '@/lib/ai/providers';
import { EFFORTS, loadAiSettings, priceFor, providerKey, resolveAiSettings } from '@/lib/ai/settings';
import { aiSettingsInput, MAX_BUDGET_USD } from '@/lib/ai/settingsInput';
import { recordManualPrice } from '@/lib/services/prices';

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
  ollamaBaseUrl: 'indirizzo di Ollama',
  'customModel:added': 'modello aggiunto',
  'customModel:removed': 'modello tolto',
};

/** «apiKey:openai:replaced» → «chiave OpenAI sostituita». */
const changeLabel = (c) => {
  const [kind, provider, what] = c.split(':');
  if (kind !== 'apiKey') return CHANGE_LABELS[c];
  return `chiave ${providerById(provider)?.label ?? provider} ${what === 'removed' ? 'eliminata' : 'sostituita'}`;
};

/**
 * I modelli per i menu, fornitore per fornitore: quelli della tabella e quelli aggiunti a mano
 * con il loro prezzo, e per Ollama quelli installati, con ciò che sanno fare. `ollamaOnline`
 * false: Ollama non risponde all'indirizzo impostato.
 */
async function modelCatalog(doc, ollamaBaseUrl) {
  const custom = doc.customModels ?? [];
  const local = await ollamaModels(ollamaBaseUrl);
  const catalog = providerCatalog().map((p) => {
    if (p.local) return { ...p, models: (local ?? []).map((m) => ({ id: `${p.id}:${m.name}`, vision: m.vision, tools: m.tools })) };
    const own = custom.filter((c) => c.spec.startsWith(`${p.id}:`));
    // Il prezzo in vigore oggi: quello riletto dalla pagina, se c'è, o quello della tabella.
    const rates = (name) => currentRates(priceFor({ spec: `${p.id}:${name}`, provider: p.id, name }, doc));
    const builtIn = p.models
      .filter((m) => !own.some((c) => c.spec === `${p.id}:${m}`))
      .map((m) => ({ id: `${p.id}:${m}`, ...(({ input, output }) => ({ input, output }))(rates(m)) }));
    return { ...p, models: [...builtIn, ...own.map((c) => ({ id: c.spec, ...(({ input, output }) => ({ input, output }))(rates(c.spec.slice(p.id.length + 1))), custom: true }))] };
  });
  return { catalog, ollamaOnline: local !== null, customModels: custom };
}

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
  const keys = Object.fromEntries(CLOUD_PROVIDERS.map((id) => {
    const { source, hint, unreadable } = providerKey(id, doc);
    return [id, { configured: Boolean(source), source, hint, unreadable }];
  }));
  const { catalog, ollamaOnline, customModels } = await modelCatalog(doc, settings.ollamaBaseUrl.value);

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
      ollamaBaseUrl: settings.ollamaBaseUrl,
    },
    keys,
    catalog,
    ollamaOnline,
    customModels,
    pricesCheckedAt: doc.pricesCheckedAt ?? null,
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

  await connectDB();
  const input = aiSettingsInput(await req.json().catch(() => null), await loadAiSettings());
  if (input.error) {
    return NextResponse.json({ error: (await serverTranslator('errors'))(input.error) }, { status: 400 });
  }

  const update = { $set: { ...input.set, updatedBy: session.user.id } };
  if (Object.keys(input.unset).length) update.$unset = input.unset;
  await AiSettings.updateOne({ _id: 'ai' }, update, { upsert: true });
  // Un prezzo scritto a mano entra nello storico come quelli letti dalle pagine.
  if (input.changes.includes('customModel:added')) await recordManualPrice(input.set.customModels.at(-1), session.user.id);

  await writeAudit(session, req, {
    action: 'UPDATE',
    resource: 'system',
    resourceId: 'ai',
    description: `Impostazioni IA aggiornate: ${input.changes.map(changeLabel).join(', ')}`,
    meta: { changes: input.changes },
  });
  return NextResponse.json(await settingsView());
}
