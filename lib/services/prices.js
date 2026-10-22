/**
 * @fileoverview «Aggiorna i prezzi»: rilegge le pagine ufficiali dei fornitori, propone le
 * differenze e, quando un amministratore le applica, salva i prezzi nuovi e lo storico.
 * @module lib/services/prices
 *
 * Due passi, e non uno: il tetto di spesa si fida di questi numeri e le pagine sono testo di terzi
 * letto da un modello. Ogni prezzo è già verificato sul testo della pagina
 * (lib/ai/tasks/priceUpdate.js); in più l'amministratore vede vecchio e nuovo prima di applicare.
 */

import AiSettings from '../models/AiSettings.js';
import ModelPrice from '../models/ModelPrice.js';
import PriceCheck from '../models/PriceCheck.js';
import { AiError, runStructured } from '../ai/index.js';
import { currentRates, PRICES, PRICES_VERIFIED_ON } from '../ai/pricing.js';
import { CLOUD_PROVIDERS, parseModelSpec } from '../ai/providers.js';
import { loadAiSettings, priceFor } from '../ai/settings.js';
import { MAX_TEXT_CHARS, relevantText, SCHEMA, sourceTexts, SYSTEM, verifyExtraction } from '../ai/tasks/priceUpdate.js';
import logger from '../logger.js';

const today = () => new Date().toISOString().slice(0, 10);
const same = (a, b) => (a ?? null) === (b ?? null) || (a != null && b != null && Math.abs(a - b) < 1e-9);

/** I modelli a pagamento di cui tenere il prezzo: quelli della tabella e quelli aggiunti a mano. */
export function modelsInScope(doc) {
  const specs = new Set(Object.entries(PRICES)
    .filter(([name]) => !/-\d{8}$/.test(name))
    .map(([name, p]) => `${p.provider}:${name}`));
  for (const c of doc.customModels ?? []) specs.add(c.spec);
  const byProvider = Object.fromEntries(CLOUD_PROVIDERS.map((id) => [id, []]));
  for (const spec of specs) {
    const parsed = parseModelSpec(spec);
    if (byProvider[parsed?.provider]) byProvider[parsed.provider].push(parsed.name);
  }
  return byProvider;
}

/** Il prezzo in vigore oggi, nella forma confrontabile con quello letto. */
function currentOf(spec, doc) {
  const price = priceFor(parseModelSpec(spec), doc);
  if (!price) return null;
  const r = currentRates(price);
  return { input: r.input, output: r.output, cacheRead: r.cacheRead };
}

/** Il prossimo prezzo annunciato già noto, per non riproporlo uguale. */
function knownUpcoming(spec, doc) {
  const price = priceFor(parseModelSpec(spec), doc);
  return (price?.changes ?? []).find((c) => c.from > today()) ?? null;
}

/**
 * Legge le pagine di un fornitore e verifica ciò che il modello ne ricava.
 * @returns {Promise<{ provider: string, urls: string[], results: object[], costMicro: number, error?: string }>}
 */
async function checkProvider(provider, ids, userId) {
  let pages;
  try {
    pages = await sourceTexts(provider);
  } catch (err) {
    logger.warn('Pagina dei prezzi non raggiungibile', { provider, error: err?.message });
    return { provider, urls: [], results: [], costMicro: 0, error: 'unreachable' };
  }
  const urls = pages.map((p) => p.url);
  const text = pages.map((p) => relevantText(p.text, ids)).filter(Boolean).join('\n\n[…]\n\n').slice(0, MAX_TEXT_CHARS);
  if (!text) return { provider, urls, results: ids.map((id) => ({ id, rejected: 'notFound' })), costMicro: 0 };
  const { data, costMicro } = await runStructured({
    task: 'priceUpdate', system: SYSTEM, schema: SCHEMA, userId,
    prompt: `Provider: ${provider}\nModel ids: ${ids.join(', ')}\n\nPage excerpts:\n${text}`,
    maxTokens: Math.min(8_000, 600 + ids.length * 500),
  });
  return { provider, urls, results: verifyExtraction(data, ids, text), costMicro };
}

/**
 * Rilegge i prezzi di tutti i fornitori e salva le differenze in attesa di conferma.
 *
 * @returns {Promise<{ checkId: string|null, changes: object[], unchanged: string[],
 *   rejected: { spec: string, reason: string }[], errors: { provider: string, error: string }[],
 *   costMicro: number }>}
 * @throws {AiError} IA spenta o tetto raggiunto: senza modello non si legge nulla.
 */
export async function checkPrices(userId) {
  const doc = await loadAiSettings();
  const scope = modelsInScope(doc);
  const changes = [];
  const unchanged = [];
  const rejected = [];
  const errors = [];
  let costMicro = 0;

  for (const [provider, ids] of Object.entries(scope)) {
    if (!ids.length) continue;
    let res;
    try {
      res = await checkProvider(provider, ids, userId);
    } catch (err) {
      if (err instanceof AiError && err.code !== 'invalid') throw err;
      errors.push({ provider, error: 'unreadable' });
      continue;
    }
    costMicro += res.costMicro;
    if (res.error) errors.push({ provider, error: res.error });
    for (const r of res.results) {
      const spec = `${provider}:${r.id}`;
      if (r.rejected) {
        rejected.push({ spec, reason: r.rejected });
        continue;
      }
      const current = currentOf(spec, doc);
      const found = { input: r.input, output: r.output, cacheRead: r.cacheRead };
      const known = knownUpcoming(spec, doc);
      const newUpcoming = r.upcoming && !(known && known.from === r.upcoming.from
        && same(known.input, r.upcoming.input) && same(known.output, r.upcoming.output));
      const priceChanged = !current || !same(current.input, found.input) || !same(current.output, found.output)
        || (found.cacheRead !== null && !same(current.cacheRead, found.cacheRead));
      if (priceChanged || newUpcoming) {
        changes.push({ spec, url: res.urls.length === 1 ? res.urls[0] : null, current, found, upcoming: r.upcoming, quote: r.quote });
      } else {
        unchanged.push(spec);
      }
    }
  }

  await AiSettings.updateOne({ _id: 'ai' }, { $set: { pricesCheckedAt: new Date() } }, { upsert: true });
  const check = changes.length ? await PriceCheck.create({ changes, userId }) : null;
  return { checkId: check ? String(check._id) : null, changes, unchanged, rejected, errors, costMicro };
}

/**
 * Applica un controllo: i prezzi nuovi diventano quelli in vigore e lo storico si allunga. La
 * prima volta che un modello entra nello storico, ci entra anche il prezzo di partenza.
 *
 * @returns {Promise<{ applied: number }|null>} null se il controllo non c'è più o è già applicato.
 */
export async function applyPriceCheck(checkId, userId) {
  const check = await PriceCheck.findOneAndUpdate(
    { _id: checkId, appliedAt: null }, { $set: { appliedAt: new Date() } }, { returnDocument: 'after' },
  ).lean();
  if (!check) return null;

  const doc = await loadAiSettings();
  const customModels = [...(doc.customModels ?? [])];
  const overrides = [...(doc.priceOverrides ?? [])];
  const history = [];
  const now = new Date();

  for (const c of check.changes) {
    const changes = c.upcoming ? [c.upcoming] : undefined;
    const fields = { input: c.found.input, output: c.found.output, cacheRead: c.found.cacheRead, changes };
    const ci = customModels.findIndex((m) => m.spec === c.spec);
    if (ci >= 0) customModels[ci] = { ...customModels[ci], ...fields, updatedAt: now };
    else {
      const oi = overrides.findIndex((o) => o.spec === c.spec);
      const entry = { spec: c.spec, ...fields, url: c.url, updatedAt: now };
      if (oi >= 0) overrides[oi] = entry;
      else overrides.push(entry);
    }

    if (c.current && !(await ModelPrice.exists({ spec: c.spec }))) {
      history.push({
        spec: c.spec, ...c.current, effectiveFrom: ci >= 0 ? today() : PRICES_VERIFIED_ON,
        source: ci >= 0 ? 'manual' : 'table', userId,
      });
    }
    history.push({ spec: c.spec, ...c.found, effectiveFrom: today(), source: 'page', url: c.url, userId });
    if (c.upcoming) history.push({ spec: c.spec, ...c.upcoming, effectiveFrom: c.upcoming.from, source: 'page', url: c.url, userId });
  }

  await AiSettings.updateOne({ _id: 'ai' }, { $set: { customModels, priceOverrides: overrides, updatedBy: userId } }, { upsert: true });
  if (history.length) await ModelPrice.insertMany(history.map(({ from: _from, ...h }) => h));
  return { applied: check.changes.length };
}

/** Registra nello storico un prezzo scritto a mano da Impostazioni → IA. */
export async function recordManualPrice({ spec, input, output, cacheRead }, userId) {
  await ModelPrice.create({ spec, input, output, cacheRead, effectiveFrom: today(), source: 'manual', userId });
}

/**
 * Lo storico, modello per modello, dal più vecchio al più recente.
 * @returns {Promise<{ spec: string, entries: object[] }[]>}
 */
export async function priceHistory() {
  const rows = await ModelPrice.find().sort({ spec: 1, effectiveFrom: 1, createdAt: 1 })
    .select('spec input output cacheRead effectiveFrom source url createdAt').lean();
  const bySpec = new Map();
  for (const { _id, ...r } of rows) bySpec.set(r.spec, [...(bySpec.get(r.spec) ?? []), { id: String(_id), ...r }]);
  return [...bySpec].map(([spec, entries]) => ({ spec, entries }));
}
