/**
 * @fileoverview Impostazioni effettive dell'IA: database prima, poi ambiente, poi predefiniti.
 * @module lib/ai/settings
 *
 * Tutto si configura dalla pagina Impostazioni → IA e si salva sul database. Le variabili
 * d'ambiente (AI_MODEL_IMPORT, AI_MONTHLY_BUDGET_USD, OLLAMA_BASE_URL e le chiavi dei fornitori,
 * come ANTHROPIC_API_KEY) restano come ripiego: valgono finché dall'interfaccia non si salva un
 * valore, così un'installazione nuova o una configurata solo da file funziona lo stesso.
 */

import AiSettings from '../models/AiSettings.js';
import { decryptSecret, encryptSecret } from '../utils/crypto.js';
import { customPrice, PRICES, refreshedPrice } from './pricing.js';
import { OLLAMA_DEFAULT_URL, providerById } from './providers.js';

export const DEFAULTS = {
  importModel: 'anthropic:claude-haiku-5-5',
  // Più capace e più caro, ma lavora solo sulle poche righe rimaste: pochi decimi di centesimo.
  importFallbackModel: 'anthropic:claude-sonnet-5-5',
  importEffort: 'low',
  // La chat: deve scegliere bene strumenti e parametri, e Sonnet 5.5 a effort basso costa pochi centesimi a domanda.
  chatModel: 'anthropic:claude-sonnet-5-5',
  chatEffort: 'low',
  monthlyBudgetUsd: 3,
  // Spento: i dati partono solo quando l'utente lo chiede, dopo averli potuti vedere.
  importAutoSuggest: false,
  // La ricerca web parte comunque solo dal suo pulsante: questo la rende disponibile.
  importWebSearch: true,
};

export const EFFORTS = ['low', 'medium', 'high'];

/** Variabile d'ambiente del ripiego per ciascuna impostazione. */
const ENV = {
  importModel: 'AI_MODEL_IMPORT',
  chatModel: 'AI_MODEL_CHAT',
  monthlyBudgetUsd: 'AI_MONTHLY_BUDGET_USD',
  ollamaBaseUrl: 'OLLAMA_BASE_URL',
};

/** @returns {Promise<object>} Il documento delle impostazioni, vuoto se non è mai stato salvato. */
export async function loadAiSettings() {
  return (await AiSettings.findById('ai').lean()) ?? {};
}

/** @typedef {'db'|'env'|'default'} Source */

/**
 * @param {*} dbValue
 * @param {string|undefined} envName
 * @param {*} fallback
 * @param {(raw: string) => *} [parse]
 * @returns {{ value: *, source: Source }}
 */
function pick(dbValue, envName, fallback, parse = (s) => s) {
  if (dbValue !== null && dbValue !== undefined) return { value: dbValue, source: 'db' };
  const raw = envName ? process.env[envName]?.trim() : '';
  if (raw) return { value: parse(raw), source: 'env' };
  return { value: fallback, source: 'default' };
}

/**
 * Il tetto non valido o negativo vale 0, cioè IA spenta: meglio niente che senza limite.
 * @returns {number}
 */
const parseBudget = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Impostazioni effettive, con la provenienza di ciascuna (per l'interfaccia).
 * @param {object} doc - Da loadAiSettings().
 */
export function resolveAiSettings(doc) {
  return {
    importModel: pick(doc.importModel, ENV.importModel, DEFAULTS.importModel),
    importFallbackModel: pick(doc.importFallbackModel, undefined, DEFAULTS.importFallbackModel),
    importEffort: pick(doc.importEffort, undefined, DEFAULTS.importEffort),
    monthlyBudgetUsd: pick(doc.monthlyBudgetUsd, ENV.monthlyBudgetUsd, DEFAULTS.monthlyBudgetUsd, parseBudget),
    importAutoSuggest: pick(doc.importAutoSuggest, undefined, DEFAULTS.importAutoSuggest),
    importWebSearch: pick(doc.importWebSearch, undefined, DEFAULTS.importWebSearch),
    chatModel: pick(doc.chatModel, ENV.chatModel, DEFAULTS.chatModel),
    chatEffort: pick(doc.chatEffort, undefined, DEFAULTS.chatEffort),
    ollamaBaseUrl: pick(doc.ollamaBaseUrl, ENV.ollamaBaseUrl, OLLAMA_DEFAULT_URL),
  };
}

/**
 * Il prezzo di un modello a pagamento: prima quello dei modelli aggiunti a mano (aggiornato anche
 * da «Aggiorna i prezzi»), poi quello della tabella del codice, aggiornato con la pagina ufficiale
 * se è stata letta.
 *
 * @param {{ spec: string, provider: string, name: string }} parsed
 * @param {object} doc
 * @returns {import('./pricing.js').ModelPrice|null} null: prezzo sconosciuto, modello rifiutato.
 */
export function priceFor(parsed, doc) {
  const custom = (doc.customModels ?? []).find((c) => c.spec === parsed.spec);
  if (custom) return customPrice({ ...custom, provider: parsed.provider });
  const table = Object.hasOwn(PRICES, parsed.name) ? PRICES[parsed.name] : null;
  if (table?.provider !== parsed.provider) return null;
  const override = (doc.priceOverrides ?? []).find((o) => o.spec === parsed.spec);
  return override ? refreshedPrice(table, override) : table;
}

/**
 * La chiave del fornitore in chiaro, solo per usarla nella chiamata: mai restituita da un'API.
 *
 * @param {string} provider
 * @param {object} doc
 * @returns {{ apiKey: string|null, source: 'db'|'env'|null, hint: string|null, unreadable: boolean }}
 *   unreadable: la chiave salvata non si decifra più (il segreto del server è cambiato); in quel
 *   caso si ripiega sull'ambiente, se c'è, e l'interfaccia chiede di reinserirla.
 */
export function providerKey(provider, doc) {
  const saved = doc.providers?.[provider];
  let unreadable = false;
  if (saved?.apiKeyEnc) {
    try {
      const apiKey = decryptSecret(saved.apiKeyEnc);
      if (apiKey) return { apiKey, source: 'db', hint: saved.hint, unreadable };
    } catch {
      unreadable = true;
    }
  }
  const keyEnv = providerById(provider)?.keyEnv;
  const env = keyEnv ? process.env[keyEnv]?.trim() : '';
  if (env) return { apiKey: env, source: 'env', hint: keyHint(env), unreadable };
  return { apiKey: null, source: null, hint: null, unreadable };
}

/** @returns {string} Gli ultimi 4 caratteri, abbastanza per riconoscere la chiave e non per usarla. */
export const keyHint = (apiKey) => apiKey.slice(-4);

/** @returns {{ apiKeyEnc: string, hint: string, updatedAt: Date }} La chiave pronta da salvare. */
export function sealKey(apiKey) {
  return { apiKeyEnc: encryptSecret(apiKey), hint: keyHint(apiKey), updatedAt: new Date() };
}
