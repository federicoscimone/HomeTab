/**
 * @fileoverview Validazione delle impostazioni IA inviate dalla pagina Impostazioni → IA.
 * @module lib/ai/settingsInput
 */

import { EFFORTS, priceFor, sealKey } from './settings.js';
import { CLOUD_PROVIDERS, isCloudModelName, isOllamaName, parseModelSpec, providerOf } from './providers.js';

/** Oltre questo tetto è quasi certamente un errore di battitura (300 invece di 3,00). */
export const MAX_BUDGET_USD = 100;

/** Prezzo massimo accettato per un modello aggiunto, in $/MTok: oltre è un errore di battitura. */
const MAX_PRICE = 1_000;

/** Quanti modelli si possono aggiungere a mano: abbastanza per provarne diversi. */
const MAX_CUSTOM_MODELS = 30;

const validPrice = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_PRICE;

/**
 * Un indirizzo http(s) per Ollama, ridotto all'origine: «http://192.168.1.20:11434».
 * @returns {string|null}
 */
export function ollamaUrl(v) {
  if (typeof v !== 'string' || v.length > 300) return null;
  try {
    const url = new URL(v.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Il modello aggiunto a mano, validato.
 * @returns {{ spec: string, input: number, output: number, cacheRead: number|null } | null}
 */
function customModelInput(v) {
  if (!v || typeof v !== 'object') return null;
  const { provider, name, input, output, cacheRead = null } = v;
  if (!CLOUD_PROVIDERS.includes(provider) || typeof name !== 'string' || !isCloudModelName(name.trim())) return null;
  if (!validPrice(input) || !validPrice(output) || (cacheRead !== null && !validPrice(cacheRead))) return null;
  return { spec: `${provider}:${name.trim()}`, input, output, cacheRead };
}

/** Caratteri stampabili senza spazi: le chiavi API sono fatte così. */
const API_KEY_RE = /^[\x21-\x7e]{20,300}$/;

/**
 * @param {unknown} body
 * @param {object} [doc] - Le impostazioni salvate: servono i modelli aggiunti a mano.
 * @returns {{ error: string } | { set: object, unset: object, changes: string[] }}
 *   `changes`: i campi toccati, per l'audit log. Mai il valore della chiave.
 *   Un campo a null torna al ripiego (variabile d'ambiente o predefinito).
 */
export function aiSettingsInput(body, doc = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalidSettings' };
  const set = {};
  const unset = {};
  const changes = [];

  // Prima i modelli aggiunti o tolti: la scelta del modello, nella stessa richiesta, li vede già.
  let customModels = doc.customModels ?? [];
  if ('addCustomModel' in body) {
    const model = customModelInput(body.addCustomModel);
    if (!model) return { error: 'invalidCustomModel' };
    customModels = [...customModels.filter((c) => c.spec !== model.spec), model];
    if (customModels.length > MAX_CUSTOM_MODELS) return { error: 'invalidCustomModel' };
    set.customModels = customModels;
    changes.push('customModel:added');
  }
  if ('removeCustomModel' in body) {
    if (typeof body.removeCustomModel !== 'string') return { error: 'invalidCustomModel' };
    customModels = customModels.filter((c) => c.spec !== body.removeCustomModel);
    set.customModels = customModels;
    changes.push('customModel:removed');
  }

  for (const field of ['importModel', 'importFallbackModel', 'chatModel']) {
    if (!(field in body)) continue;
    const v = body[field];
    if (v === null) unset[field] = '';
    else if (v === 'none') set[field] = 'none';
    else {
      const parsed = typeof v === 'string' ? parseModelSpec(v) : null;
      const provider = providerOf(parsed);
      const known = provider && (provider.local ? isOllamaName(parsed.name) : priceFor(parsed, { customModels }));
      if (!known) return { error: 'invalidModel' };
      set[field] = parsed.spec;
    }
    changes.push(field);
  }

  if ('ollamaBaseUrl' in body) {
    const v = body.ollamaBaseUrl;
    if (v === null || v === '') unset.ollamaBaseUrl = '';
    else {
      const url = ollamaUrl(v);
      if (!url) return { error: 'invalidOllamaUrl' };
      set.ollamaBaseUrl = url;
    }
    changes.push('ollamaBaseUrl');
  }

  for (const field of ['importEffort', 'chatEffort']) {
    if (!(field in body)) continue;
    const v = body[field];
    if (v === null) unset[field] = '';
    else if (EFFORTS.includes(v)) set[field] = v;
    else return { error: 'invalidEffort' };
    changes.push(field);
  }

  if ('monthlyBudgetUsd' in body) {
    const v = body.monthlyBudgetUsd;
    if (v === null) unset.monthlyBudgetUsd = '';
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0.01 && v <= MAX_BUDGET_USD) {
      set.monthlyBudgetUsd = Math.round(v * 100) / 100;
    } else return { error: 'invalidBudget' };
    changes.push('monthlyBudgetUsd');
  }

  for (const field of ['importAutoSuggest', 'importWebSearch']) {
    if (!(field in body)) continue;
    const v = body[field];
    if (v === null) unset[field] = '';
    else if (typeof v === 'boolean') set[field] = v;
    else return { error: 'invalidSettings' };
    changes.push(field);
  }

  if ('apiKey' in body) {
    const { provider, key } = body.apiKey ?? {};
    if (!CLOUD_PROVIDERS.includes(provider)) return { error: 'invalidApiKey' };
    if (key === null) unset[`providers.${provider}`] = '';
    else if (typeof key === 'string' && API_KEY_RE.test(key.trim())) set[`providers.${provider}`] = sealKey(key.trim());
    else return { error: 'invalidApiKey' };
    changes.push(`apiKey:${provider}:${key === null ? 'removed' : 'replaced'}`);
  }

  if (changes.length === 0) return { error: 'invalidSettings' };
  return { set, unset, changes };
}
