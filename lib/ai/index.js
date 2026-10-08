/**
 * @fileoverview Punto d'ingresso unico per le chiamate ai modelli.
 * @module lib/ai
 *
 * Ogni funzione dell'app che usa l'IA è un "compito" (TASKS) con il suo modello, configurabile
 * da variabile d'ambiente. `runStructured` fa una chiamata che restituisce JSON conforme a uno
 * schema, dentro il tetto di spesa: prenota, chiama, salda, registra.
 *
 * Il testo da inviare va mascherato da chi chiama, con lib/ai/mask.js: solo il chiamante sa
 * quali campi contengono dati personali.
 */

import logger from '../logger.js';
import { isDemoMode } from '../demoAccounts.js';
import AiUsage from '../models/AiUsage.js';
import { reserve, settle, monthlyCapMicro } from './budget.js';
import { costMicroUsd, inputTokensUpperBound, maxCostMicroUsd } from './pricing.js';
import { parseModelSpec, providerOf } from './providers.js';

/** Modelli predefiniti, scelti per costo e compito; si cambiano con le variabili d'ambiente. */
export const DEFAULT_MODELS = {
  AI_MODEL_IMPORT: 'anthropic:claude-haiku-5-5',
  AI_MODEL_CHAT: 'anthropic:claude-sonnet-5-5',
};

/**
 * @type {Object<string, { modelEnv: keyof DEFAULT_MODELS, effort?: string }>}
 * `effort` vale solo per i modelli che lo accettano; per gli altri si ignora.
 */
export const TASKS = {
  importCategorize: { modelEnv: 'AI_MODEL_IMPORT', effort: 'low' },
  importTemplate: { modelEnv: 'AI_MODEL_IMPORT', effort: 'medium' },
};

/** Errore con un codice che le route traducono per l'utente. */
export class AiError extends Error {
  /** @param {'unavailable'|'budget'|'failed'|'invalid'} code */
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/** @returns {string|null} Il modello del compito ("fornitore:nome"), null se spento con "none". */
function modelSpecFor(task) {
  const { modelEnv } = TASKS[task];
  const value = process.env[modelEnv]?.trim();
  if (value === 'none') return null;
  return value || DEFAULT_MODELS[modelEnv];
}

/**
 * Se un compito può usare l'IA, e se no perché.
 * @param {keyof TASKS} task
 * @returns {{ available: boolean, reason: string|null, model: string|null }}
 *   reason: 'demo' | 'off' | 'unknownModel' | 'notConfigured' | 'noBudget' | null
 */
export function aiAvailability(task) {
  const spec = modelSpecFor(task);
  const parsed = parseModelSpec(spec);
  const provider = providerOf(parsed);
  const no = (reason) => ({ available: false, reason, model: spec });
  // Nella demo pubblica chiunque potrebbe consumare il credito: l'IA resta spenta.
  if (isDemoMode()) return no('demo');
  if (!spec) return no('off');
  if (!provider || !provider.knows(parsed.name)) return no('unknownModel');
  if (!provider.configured()) return no('notConfigured');
  if (!provider.local && monthlyCapMicro() <= 0) return no('noBudget');
  return { available: true, reason: null, model: parsed.spec };
}

/**
 * Token consumati, dal formato standard di LangChain a quello delle tariffe.
 * LangChain somma in `input_tokens` anche i token letti e scritti in cache, che però costano
 * diversamente: qui si scorporano.
 */
function usageFrom(meta) {
  const cacheWrite = meta?.input_token_details?.cache_creation ?? 0;
  const cacheRead = meta?.input_token_details?.cache_read ?? 0;
  return {
    input_tokens: Math.max(0, (meta?.input_tokens ?? 0) - cacheWrite - cacheRead),
    output_tokens: meta?.output_tokens ?? 0,
    cache_creation_input_tokens: cacheWrite,
    cache_read_input_tokens: cacheRead,
  };
}

/**
 * Una chiamata con risposta JSON conforme a `schema`, dentro il tetto di spesa.
 *
 * @param {Object} args
 * @param {keyof TASKS} args.task
 * @param {string} args.system       - Istruzioni.
 * @param {string} args.prompt       - Dati, già mascherati.
 * @param {object} args.schema       - JSON Schema della risposta.
 * @param {number} args.maxTokens    - Limite rigido all'uscita, ragionamento compreso.
 * @param {string} [args.userId]
 * @returns {Promise<{ data: any, costMicro: number, model: string }>}
 * @throws {AiError} unavailable · budget (tetto raggiunto) · failed (errore o timeout) ·
 *   invalid (risposta non conforme)
 */
export async function runStructured({ task, system, prompt, schema, maxTokens, userId = null }) {
  const availability = aiAvailability(task);
  if (!availability.available) throw new AiError('unavailable', availability.reason);

  const parsed = parseModelSpec(availability.model);
  const provider = providerOf(parsed);
  const estimatedInput = inputTokensUpperBound(system, prompt, JSON.stringify(schema));
  const maxCost = provider.local ? 0 : maxCostMicroUsd(parsed.name, estimatedInput, maxTokens);

  const reservation = provider.local ? null : await reserve(maxCost);
  if (!provider.local && !reservation) throw new AiError('budget');

  const record = { task, model: parsed.spec, reservedMicro: maxCost, userId };
  const started = Date.now();
  let raw;
  let result;
  try {
    const model = provider.create({ name: parsed.name, maxTokens, effort: TASKS[task].effort })
      .withStructuredOutput(schema, { method: 'jsonSchema', includeRaw: true });
    ({ raw, parsed: result } = await model.invoke([['system', system], ['human', prompt]]));
  } catch (err) {
    // Il server ha risposto con un errore (status numerico): la richiesta non è addebitata.
    // Timeout o connessione caduta: non si sa se è stata elaborata, la prenotazione resta.
    const answered = typeof err?.status === 'number';
    const costMicro = answered ? 0 : maxCost;
    if (reservation) await settle(reservation, costMicro);
    await AiUsage.create({
      ...record, outcome: answered ? 'error' : 'unknown', costMicro,
      durationMs: Date.now() - started, error: String(err?.message || err).slice(0, 500),
    });
    logger.warn('Chiamata IA fallita', { task, model: parsed.spec, status: err?.status, message: err?.message });
    throw new AiError('failed', err?.message);
  }

  const usage = usageFrom(raw?.usage_metadata);
  const costMicro = provider.local ? 0 : costMicroUsd(parsed.name, usage);
  if (reservation) await settle(reservation, costMicro);
  const totalInput = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
  if (totalInput > estimatedInput) {
    // Non dovrebbe succedere mai (vedi inputTokensUpperBound): se succede, la stima va rivista.
    logger.warn('Ingresso IA oltre la stima', { task, estimatedInput, totalInput });
  }

  const valid = result !== null && result !== undefined;
  await AiUsage.create({
    ...record, outcome: valid ? 'ok' : 'invalid', costMicro, durationMs: Date.now() - started,
    inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens, cacheReadTokens: usage.cache_read_input_tokens,
  });
  if (!valid) throw new AiError('invalid');
  return { data: result, costMicro, model: parsed.spec };
}
