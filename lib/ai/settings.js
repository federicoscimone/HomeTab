/**
 * @fileoverview Impostazioni effettive dell'IA: database prima, poi ambiente, poi predefiniti.
 * @module lib/ai/settings
 *
 * Tutto si configura dalla pagina Impostazioni → IA e si salva sul database. Le variabili
 * d'ambiente (AI_MODEL_IMPORT, AI_MONTHLY_BUDGET_USD, ANTHROPIC_API_KEY) restano come ripiego:
 * valgono finché dall'interfaccia non si salva un valore, così un'installazione nuova o una
 * configurata solo da file funziona lo stesso.
 */

import AiSettings from '../models/AiSettings.js';
import { decryptSecret, encryptSecret } from '../utils/crypto.js';

export const DEFAULTS = {
  importModel: 'anthropic:claude-haiku-5-5',
  importEffort: 'low',
  monthlyBudgetUsd: 3,
};

export const EFFORTS = ['low', 'medium', 'high'];

/** Variabile d'ambiente del ripiego per ciascuna impostazione. */
const ENV = {
  importModel: 'AI_MODEL_IMPORT',
  monthlyBudgetUsd: 'AI_MONTHLY_BUDGET_USD',
};

/** Chiave API di ripiego per fornitore. */
const KEY_ENV = { anthropic: 'ANTHROPIC_API_KEY' };

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
    importEffort: pick(doc.importEffort, undefined, DEFAULTS.importEffort),
    monthlyBudgetUsd: pick(doc.monthlyBudgetUsd, ENV.monthlyBudgetUsd, DEFAULTS.monthlyBudgetUsd, parseBudget),
  };
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
  const env = KEY_ENV[provider] ? process.env[KEY_ENV[provider]]?.trim() : '';
  if (env) return { apiKey: env, source: 'env', hint: keyHint(env), unreadable };
  return { apiKey: null, source: null, hint: null, unreadable };
}

/** @returns {string} Gli ultimi 4 caratteri, abbastanza per riconoscere la chiave e non per usarla. */
export const keyHint = (apiKey) => apiKey.slice(-4);

/** @returns {{ apiKeyEnc: string, hint: string, updatedAt: Date }} La chiave pronta da salvare. */
export function sealKey(apiKey) {
  return { apiKeyEnc: encryptSecret(apiKey), hint: keyHint(apiKey), updatedAt: new Date() };
}
