/**
 * @fileoverview Punto d'ingresso unico per le chiamate ai modelli.
 * @module lib/ai
 *
 * Ogni funzione dell'app che usa l'IA è un "compito" (TASKS), con modello ed effort presi dalle
 * impostazioni (pagina Impostazioni → IA, lib/ai/settings.js). `runStructured` fa una chiamata
 * che restituisce JSON conforme a uno schema, dentro il tetto di spesa: prenota, chiama, salda,
 * registra.
 *
 * Il testo da inviare va mascherato da chi chiama, con lib/ai/mask.js: solo il chiamante sa
 * quali campi contengono dati personali.
 */

import { z } from 'zod';
import logger from '../logger.js';
import { isDemoMode } from '../demoAccounts.js';
import AiUsage from '../models/AiUsage.js';
import { capMicro, reserve, settle } from './budget.js';
import {
  costMicroUsd, inputTokensUpperBound, maxCostMicroUsd,
  WEB_RESULT_TOKENS, WEB_SEARCH_MICRO, WEB_TOOL_OVERHEAD_TOKENS, webSearchTool,
} from './pricing.js';
import { parseModelSpec, providerOf } from './providers.js';
import { loadAiSettings, providerKey, resolveAiSettings } from './settings.js';

/**
 * Ogni compito dice quale impostazione dà il modello e quale l'effort. L'effort vale solo per i
 * modelli che lo accettano; per gli altri si ignora. `minEffort`: il minimo per quel compito,
 * anche se nelle impostazioni è più basso.
 * `enabledBy`: l'impostazione booleana che accende il compito.
 * @type {Object<string, { model: 'importModel'|'importFallbackModel'|'chatModel', effort: 'importEffort'|'chatEffort', minEffort?: string, enabledBy?: string }>}
 */
export const TASKS = {
  importCategorize: { model: 'importModel', effort: 'importEffort' },
  // Le righe che il primo modello lascia vuote, ripassate a un modello più capace.
  importCategorizeFallback: { model: 'importFallbackModel', effort: 'importEffort' },
  // Ricerca web degli esercenti rimasti sconosciuti: solo su richiesta, riga per riga.
  importWebSearch: { model: 'importModel', effort: 'importEffort', enabledBy: 'importWebSearch' },
  // La chat sui dati: ogni passo del ciclo dell'agente è una chiamata con il suo budget.
  chat: { model: 'chatModel', effort: 'chatEffort' },
  // Capitoli ISTAT delle categorie: solo i nomi, una chiamata, con il modello dell'import.
  istatMapping: { model: 'importModel', effort: 'importEffort' },
  // La foto di uno scontrino mandata al bot: una chiamata con un'immagine, modello dell'import.
  receiptScan: { model: 'importModel', effort: 'importEffort' },
  // Consigli di risparmio, solo su richiesta: una chiamata, con il modello della chat.
  advice: { model: 'chatModel', effort: 'chatEffort' },
  // Una chiamata per banca, una volta sola: capire le colonne di un file nuovo merita più
  // ragionamento, e la differenza di costo è di frazioni di centesimo.
  importTemplate: { model: 'importModel', effort: 'importEffort', minEffort: 'medium' },
};

const EFFORT_ORDER = ['low', 'medium', 'high'];
const atLeast = (effort, min) =>
  (min && EFFORT_ORDER.indexOf(effort) < EFFORT_ORDER.indexOf(min) ? min : effort);

/** Errore con un codice che le route traducono per l'utente. */
export class AiError extends Error {
  /** @param {'unavailable'|'budget'|'failed'|'invalid'} code */
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/**
 * Se un compito può usare l'IA, e se no perché, con tutto ciò che serve alla chiamata.
 *
 * @param {keyof TASKS} task
 * @param {object} doc - Impostazioni salvate, da loadAiSettings().
 * @returns {{ available: boolean, reason: string|null, model: string|null,
 *   effort?: string, capMicro?: number, apiKey?: string|null }}
 *   reason: 'demo' | 'off' | 'unknownModel' | 'notConfigured' | 'noBudget' | null
 */
export function aiAvailability(task, doc) {
  const settings = resolveAiSettings(doc);
  const spec = settings[TASKS[task].model].value;
  const no = (reason) => ({ available: false, reason, model: spec === 'none' ? null : spec });
  // Nella demo pubblica chiunque potrebbe consumare il credito: l'IA resta spenta.
  if (isDemoMode()) return no('demo');
  if (!spec || spec === 'none') return no('off');
  const { enabledBy } = TASKS[task];
  if (enabledBy && settings[enabledBy]?.value !== true) return no('off');
  const parsed = parseModelSpec(spec);
  const provider = providerOf(parsed);
  if (!provider || !provider.knows(parsed.name)) return no('unknownModel');
  if (enabledBy === 'importWebSearch' && !webSearchTool(parsed.name)) return no('noWebSearch');
  const { apiKey } = provider.needsKey ? providerKey(parsed.provider, doc) : { apiKey: null };
  if (provider.needsKey && !apiKey) return no('notConfigured');
  const cap = capMicro(settings.monthlyBudgetUsd.value);
  if (!provider.local && cap <= 0) return no('noBudget');
  return {
    available: true, reason: null, model: parsed.spec,
    effort: atLeast(settings[TASKS[task].effort].value, TASKS[task].minEffort), capMicro: cap, apiKey,
  };
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
 * Chiamata con la ricerca web di Anthropic attiva e risposta JSON conforme allo schema.
 * LangChain passa lo strumento lato server così com'è; il JSON finale sta nei blocchi di testo,
 * dopo quelli delle ricerche. `pause_turn` (il ciclo lato server si è fermato a metà) non si
 * riprende: la ripresa sarebbe una richiesta nuova, con un nuovo budget di ricerche fuori dalla
 * prenotazione. Si conta come risposta non valida.
 */
async function invokeWithWebSearch(model, { system, prompt, schema, tool, maxUses }) {
  const res = await model.invoke([['system', system], ['human', prompt]], {
    tools: [{ type: tool, name: 'web_search', max_uses: maxUses }],
    outputConfig: { format: { type: 'json_schema', schema } },
  });
  const meta = res.response_metadata ?? {};
  const searches = meta.usage?.server_tool_use?.web_search_requests ?? 0;
  const blocks = Array.isArray(res.content) ? res.content : [{ type: 'text', text: String(res.content ?? '') }];
  let data = null;
  if (meta.stop_reason !== 'pause_turn') {
    try {
      data = JSON.parse(blocks.filter((b) => b.type === 'text').map((b) => b.text).join(''));
    } catch {
      data = null;
    }
  }
  return { data, raw: res, searches };
}

/**
 * Un'immagine costa ⌈larghezza/28⌉ × ⌈altezza/28⌉ token, fino a 4.784 sui modelli dalla 4.7 in
 * poi, che la rimpiccioliscono oltre quel limite: è il tetto da prenotare per ognuna.
 */
const IMAGE_MAX_TOKENS = 4_784;

/** Il messaggio dell'utente: le immagini prima del testo, come raccomanda la documentazione. */
function humanContent(prompt, images) {
  if (!images.length) return prompt;
  return [
    ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
    { type: 'text', text: prompt },
  ];
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
 * @param {{ maxUses: number }} [args.webSearch] - Attiva la ricerca web, al massimo `maxUses`
 *   ricerche: il loro costo fisso e i token dei risultati entrano nella prenotazione.
 * @param {{ mediaType: string, data: string }[]} [args.images] - Immagini in base64, prima del testo.
 * @returns {Promise<{ data: any, costMicro: number, model: string, searches: number }>}
 * @throws {AiError} unavailable · budget (tetto raggiunto) · failed (errore o timeout) ·
 *   invalid (risposta non conforme)
 */
export async function runStructured({ task, system, prompt, schema, maxTokens, userId = null, webSearch = null, images = [] }) {
  const availability = aiAvailability(task, await loadAiSettings());
  if (!availability.available) throw new AiError('unavailable', availability.reason);

  const parsed = parseModelSpec(availability.model);
  const provider = providerOf(parsed);
  const tool = webSearch ? webSearchTool(parsed.name) : null;
  if (webSearch && !tool) throw new AiError('unavailable', 'noWebSearch');
  const maxUses = tool ? webSearch.maxUses : 0;
  const estimatedInput = inputTokensUpperBound(system, prompt, JSON.stringify(schema))
    + (tool ? WEB_TOOL_OVERHEAD_TOKENS + maxUses * WEB_RESULT_TOKENS : 0)
    + images.length * IMAGE_MAX_TOKENS;
  const maxCost = provider.local ? 0 : maxCostMicroUsd(parsed.name, estimatedInput, maxTokens) + maxUses * WEB_SEARCH_MICRO;

  const reservation = provider.local ? null : await reserve(maxCost, availability.capMicro);
  if (!provider.local && !reservation) throw new AiError('budget');

  const record = { task, model: parsed.spec, reservedMicro: maxCost, userId };
  const started = Date.now();
  let raw;
  let result;
  let searches = 0;
  try {
    const model = provider.create({
      name: parsed.name, maxTokens, effort: availability.effort, apiKey: availability.apiKey,
    });
    if (tool) {
      ({ raw, data: result, searches } = await invokeWithWebSearch(model, { system, prompt, schema, tool, maxUses }));
    } else {
      ({ raw, parsed: result } = await model
        .withStructuredOutput(schema, { method: 'jsonSchema', includeRaw: true })
        .invoke([['system', system], ['human', humanContent(prompt, images)]]));
    }
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
  const costMicro = provider.local ? 0 : costMicroUsd(parsed.name, usage) + searches * WEB_SEARCH_MICRO;
  if (reservation) await settle(reservation, costMicro);
  if (costMicro > maxCost) {
    // Possibile solo con la ricerca web, se i risultati superano la stima: il contatore registra
    // il costo vero, quindi il mese può chiudersi un poco sopra il tetto. Il limite del workspace
    // nella Console resta la rete di sicurezza.
    logger.warn('Costo IA oltre la prenotazione', { task, maxCost, costMicro, searches });
  }
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
    webSearches: searches,
  });
  if (!valid) throw new AiError('invalid');
  return { data: result, costMicro, model: parsed.spec, searches };
}

/**
 * Un passo dell'agente della chat: una chiamata con gli strumenti a disposizione, dentro il tetto
 * di spesa, con il testo trasmesso man mano che arriva.
 *
 * La stima per eccesso dell'ingresso comprende tutto ciò che parte: messaggi (con i risultati
 * degli strumenti dei passi precedenti) e schemi degli strumenti.
 *
 * @param {Object} args
 * @param {Array} args.messages - Messaggi LangChain (system, human, ai, tool).
 * @param {Array} args.tools    - Strumenti LangChain.
 * @param {number} args.maxTokens
 * @param {(delta: string) => void} [args.onText] - Riceve il testo man mano che arriva.
 * @param {string} [args.userId]
 * @returns {Promise<{ message: import('@langchain/core/messages').AIMessage, costMicro: number, model: string }>}
 * @throws {AiError} unavailable · budget · failed
 */
export async function runToolStep({ messages, tools, maxTokens, onText = () => {}, userId = null }) {
  const task = 'chat';
  const availability = aiAvailability(task, await loadAiSettings());
  if (!availability.available) throw new AiError('unavailable', availability.reason);

  const parsed = parseModelSpec(availability.model);
  const provider = providerOf(parsed);
  const toolSchemas = tools.map((t) => ({ name: t.name, description: t.description, schema: z.toJSONSchema(t.schema) }));
  const estimatedInput = inputTokensUpperBound(JSON.stringify(messages), JSON.stringify(toolSchemas));
  const maxCost = provider.local ? 0 : maxCostMicroUsd(parsed.name, estimatedInput, maxTokens);
  const reservation = provider.local ? null : await reserve(maxCost, availability.capMicro);
  if (!provider.local && !reservation) throw new AiError('budget');

  const record = { task, model: parsed.spec, reservedMicro: maxCost, userId };
  const started = Date.now();
  let message = null;
  try {
    const model = provider.create({ name: parsed.name, maxTokens, effort: availability.effort, apiKey: availability.apiKey }).bindTools(tools);
    for await (const chunk of await model.stream(messages)) {
      message = message ? message.concat(chunk) : chunk;
      const delta = typeof chunk.content === 'string'
        ? chunk.content
        : (chunk.content ?? []).filter((b) => b.type === 'text' || b.type === 'text_delta').map((b) => b.text ?? '').join('');
      if (delta) onText(delta);
    }
  } catch (err) {
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

  const usage = usageFrom(message?.usage_metadata);
  const costMicro = provider.local ? 0 : costMicroUsd(parsed.name, usage);
  if (reservation) await settle(reservation, costMicro);
  await AiUsage.create({
    ...record, outcome: message ? 'ok' : 'invalid', costMicro, durationMs: Date.now() - started,
    inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens, cacheReadTokens: usage.cache_read_input_tokens,
  });
  if (!message) throw new AiError('invalid');
  return { message, costMicro, model: parsed.spec };
}
