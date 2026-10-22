/**
 * @fileoverview Fornitori di modelli, tutti attraverso LangChain.
 * @module lib/ai/providers
 *
 * Un modello si indica come "fornitore:nome", per esempio `anthropic:claude-haiku-5-5` o
 * `ollama:qwen3:8b`. Ogni fornitore restituisce un chat model di LangChain, quindi il resto del
 * codice non sa quale modello sta usando: per aggiungerne uno si installa il suo pacchetto
 * `@langchain/<fornitore>` e si aggiunge una voce qui.
 *
 * Un registro esplicito invece di `initChatModel`: quello importa i pacchetti dei fornitori a
 * partire da una stringa, e il bundler di Next dovrebbe risolverli tutti in fase di build, anche
 * quelli non installati.
 *
 * Le differenze fra fornitori che il resto del codice deve conoscere stanno nei campi del
 * registro: come si chiede una risposta strutturata, quanto si prenota per un'immagine, se le
 * istruzioni accettano il segnaposto della cache.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatMistralAI } from '@langchain/mistralai';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { PRICES, supportsEffort } from './pricing.js';

/** Oltre questo tempo la chiamata si abbandona; l'esito resta incerto e si conta come spesa. */
const TIMEOUT_MS = 90_000;

/**
 * In locale la prima chiamata carica il modello in memoria, e su un computer senza scheda video
 * (o su un Raspberry) una risposta lunga richiede minuti: il tempo massimo è più largo, e
 * abbandonare non costa nulla.
 */
const LOCAL_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 300_000;

/**
 * Contesto dei modelli locali, in token. Ollama di suo ne usa pochi (4.096) e **taglia in
 * silenzio** l'inizio di un prompt più lungo: la chat, con istruzioni e strumenti, ci finirebbe
 * dentro. 16.384 basta a tutti i compiti di HomeTab; più contesto vuol dire più memoria occupata.
 * Resta fisso perché cambiarlo fra una chiamata e l'altra costringe Ollama a ricaricare il modello.
 */
export const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 16_384;

/** Dove risponde Ollama se non è impostato altro: la stessa macchina. */
export const OLLAMA_DEFAULT_URL = 'http://127.0.0.1:11434';

/** I nomi dei modelli Ollama: «qwen3:8b», «gemma3:4b-it-qat», «utente/modello:etichetta». */
const OLLAMA_NAME_RE = /^[a-zA-Z0-9][\w.\-/:]{0,199}$/;

/**
 * Token da prenotare per un'immagine. Anthropic: ⌈larghezza/28⌉ × ⌈altezza/28⌉, fino a 4.784 sui
 * modelli dalla 4.7 in poi. Gli altri contano in modi diversi e non sempre documentati: si prenota
 * largo, tanto la prenotazione dura solo il tempo della chiamata e poi si salda il costo vero.
 */
const IMAGE_TOKENS_GENEROUS = 8_000;

/** I modelli della tabella prezzi per quel fornitore, senza gli alias con la data. */
const builtIn = (provider) =>
  Object.keys(PRICES).filter((m) => PRICES[m].provider === provider && !/-\d{8}$/.test(m));

/**
 * Prova una chiave con l'elenco dei modelli: una chiamata che non consuma token e non costa nulla.
 *
 * @param {number[]} rejected - Gli stati con cui il fornitore rifiuta una chiave (Google usa il 400).
 * @returns {Promise<{ valid: boolean|null }>} null se il fornitore non ha dato una risposta chiara.
 */
async function probe(url, headers, rejected = [401, 403]) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (res.ok) return { valid: true };
    return { valid: rejected.includes(res.status) ? false : null };
  } catch {
    return { valid: null };
  }
}

/** I modelli che non sono per la chat: embedding, audio, immagini, video, moderazione, OCR. */
const NOT_CHAT_RE = /(embed|tts|whisper|transcri|dall-e|image|imagen|veo|audio|realtime|moderation|search|aqa|ocr|lyria|computer-use|robotics|live|codestral-mamba)/i;
/** Le copie con la data («-20251001», «-2026-08-14») e gli alias mobili («-latest»). */
const DATED_RE = /-(\d{8}|\d{4}-\d{2}-\d{2})$/;

/**
 * Dall'elenco dei modelli di un fornitore, quelli che servono come candidati: di chat, senza gli
 * alias «-latest», e senza la copia con la data quando esiste anche la versione senza.
 *
 * @param {{ id: string, name?: string, created?: number }[]} models
 * @returns {{ id: string, name: string|null, created: number }[]} Dal più recente.
 */
export function chatModelsOnly(models) {
  const ids = new Set(models.map((m) => m.id));
  return models
    .filter((m) => !NOT_CHAT_RE.test(m.id) && !m.id.endsWith('-latest'))
    .filter((m) => !(DATED_RE.test(m.id) && ids.has(m.id.replace(DATED_RE, ''))))
    .map((m) => ({ id: m.id, name: m.name ?? null, created: m.created ?? 0 }))
    .sort((a, b) => b.created - a.created);
}

/** I pezzi del nome che indicano la versione, non la famiglia: numeri e «preview», «exp», «latest». */
const VERSION_TOKEN_RE = /^(\d+|preview|exp|experimental|latest)$/;
const tokensOf = (id) => id.split(/[-.]/).filter(Boolean);
/** «claude-opus-5-5» → «claude-opus»; «gemini-3.1-pro-preview» → «gemini-pro». */
export const familyOf = (id) => tokensOf(id).filter((t) => !VERSION_TOKEN_RE.test(t)).join('-');
const versionOf = (id) => tokensOf(id).filter((t) => /^\d+$/.test(t)).map(Number);
/** Più recente prima: la data d'uscita, se il fornitore la dà; se no, il numero di versione. */
function newerFirst(a, b) {
  if ((b.created ?? 0) !== (a.created ?? 0)) return (b.created ?? 0) - (a.created ?? 0);
  const va = versionOf(a.id);
  const vb = versionOf(b.id);
  for (let i = 0; i < Math.max(va.length, vb.length); i += 1) {
    if ((vb[i] ?? -1) !== (va[i] ?? -1)) return (vb[i] ?? -1) - (va[i] ?? -1);
  }
  return 0;
}

/**
 * I modelli nuovi da proporre: per ogni famiglia solo il più recente, e solo se l'app non lo ha
 * già. Una versione vecchia (Opus 4.6 quando c'è Opus 5.5) non si propone mai.
 *
 * @param {{ id: string, name?: string, created?: number }[]} models - Dall'API del fornitore.
 * @param {string[]} known - I modelli già nell'elenco dell'app.
 * @returns {{ id: string, name: string|null, created: number }[]}
 */
export function newModelsOnly(models, known) {
  const listed = chatModelsOnly(models);
  const all = [...listed, ...known.filter((id) => !listed.some((m) => m.id === id)).map((id) => ({ id, name: null, created: 0 }))];
  const newest = new Map();
  for (const m of all) {
    const family = familyOf(m.id);
    const best = newest.get(family);
    if (!best || newerFirst(m, best) < 0) newest.set(family, m);
  }
  return [...newest.values()].filter((m) => !known.includes(m.id)).sort(newerFirst);
}

/** Un elenco di modelli dall'API di un fornitore, con la chiave; null se non risponde. */
async function fetchJson(url, headers) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * I modelli installati in Ollama, con ciò che sanno fare: le immagini servono agli scontrini, gli
 * strumenti alla chat.
 *
 * @returns {Promise<{ name: string, vision: boolean, tools: boolean }[]|null>} null se Ollama non risponde.
 */
export async function ollamaModels(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3_000), cache: 'no-store' });
    if (!res.ok) return null;
    const { models = [] } = await res.json();
    return await Promise.all(models.map(async ({ name, capabilities: listed }) => {
      // Le versioni recenti le danno già nell'elenco; le più vecchie solo modello per modello.
      if (Array.isArray(listed)) return { name, vision: listed.includes('vision'), tools: listed.includes('tools') };
      try {
        const show = await fetch(`${base}/api/show`, {
          method: 'POST', body: JSON.stringify({ model: name }), signal: AbortSignal.timeout(3_000), cache: 'no-store',
        });
        const { capabilities = [] } = show.ok ? await show.json() : {};
        return { name, vision: capabilities.includes('vision'), tools: capabilities.includes('tools') };
      } catch {
        return { name, vision: false, tools: false };
      }
    }));
  } catch {
    return null;
  }
}

/**
 * @typedef {Object} Provider
 * @property {string} label          - Nome per l'interfaccia.
 * @property {boolean} local         - Gira in casa: nessuna chiave, costo zero, nessun tetto.
 * @property {string} [keyEnv]       - Variabile d'ambiente di ripiego per la chiave.
 * @property {string} [keyPrefix]    - Come iniziano le chiavi, per avvisare di una copia monca.
 * @property {string} [keyUrl]       - Dove si crea una chiave.
 * @property {'jsonSchema'|'functionCalling'} structured - Come chiedere una risposta conforme a
 *   uno schema: lo schema nativo dove c'è, altrimenti una chiamata a funzione forzata.
 * @property {number} imageTokens    - Token da prenotare per ogni immagine.
 * @property {boolean} promptCache   - Le istruzioni accettano il segnaposto `cache_control`.
 * @property {number} timeoutMs
 * @property {string[]} models       - Modelli della tabella prezzi, per il menu.
 * @property {(opts: { name: string, maxTokens: number, effort?: string, apiKey?: string,
 *   baseUrl?: string, price?: object }) =>
 *   import('@langchain/core/language_models/chat_models').BaseChatModel} create
 * @property {(secret: string) => Promise<{ valid: boolean|null }>} verify - Chiave o indirizzo.
 * @property {(apiKey: string) => Promise<{ id: string, name?: string, created?: number }[]|null>} [listModels]
 *   I modelli che la chiave può usare, dall'API del fornitore (gratis): gli identificativi veri
 *   per i modelli nuovi trovati da «Aggiorna i prezzi».
 */

/** @type {Object<string, Provider>} */
const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    local: false,
    keyEnv: 'ANTHROPIC_API_KEY',
    keyPrefix: 'sk-ant-',
    keyUrl: 'https://platform.claude.com/settings/keys',
    structured: 'jsonSchema',
    imageTokens: 4_784,
    promptCache: true,
    timeoutMs: TIMEOUT_MS,
    models: builtIn('anthropic'),
    create: ({ name, maxTokens, effort, apiKey, price }) => new ChatAnthropic({
      model: name,
      maxTokens,
      apiKey,
      // Solo per le prove contro un'API finta; in produzione resta quella di Anthropic.
      anthropicApiUrl: process.env.ANTHROPIC_BASE_URL || undefined,
      // Nessuna ripetizione automatica, né di LangChain (6 di default) né dell'SDK (2): una
      // richiesta andata in timeout può essere stata elaborata e addebitata, e ripeterla la
      // pagherebbe due volte fuori dalla prenotazione. Riprova l'utente, consapevolmente.
      // Vale per tutti i fornitori a pagamento.
      maxRetries: 0,
      clientOptions: { maxRetries: 0, timeout: TIMEOUT_MS },
      ...(effort && supportsEffort(price ?? name) ? { outputConfig: { effort } } : {}),
    }),
    verify: (apiKey) => probe(
      `${(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/models?limit=1`,
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    ),
    listModels: async (apiKey) => {
      const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
      const body = await fetchJson(`${base}/v1/models?limit=100`, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });
      return body?.data?.map((m) => ({ id: m.id, name: m.display_name, created: Date.parse(m.created_at) || 0 })) ?? null;
    },
  },
  openai: {
    label: 'OpenAI',
    local: false,
    keyEnv: 'OPENAI_API_KEY',
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    structured: 'jsonSchema',
    imageTokens: IMAGE_TOKENS_GENEROUS,
    promptCache: false,
    timeoutMs: TIMEOUT_MS,
    models: builtIn('openai'),
    create: ({ name, maxTokens, effort, apiKey, price }) => new ChatOpenAI({
      model: name,
      maxTokens,
      apiKey,
      maxRetries: 0,
      timeout: TIMEOUT_MS,
      ...(effort && supportsEffort(price ?? name) ? { reasoning: { effort } } : {}),
    }),
    verify: (apiKey) => probe('https://api.openai.com/v1/models', { Authorization: `Bearer ${apiKey}` }),
    listModels: async (apiKey) => {
      const body = await fetchJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${apiKey}` });
      return body?.data?.map((m) => ({ id: m.id, created: (m.created ?? 0) * 1000 })) ?? null;
    },
  },
  google: {
    label: 'Google Gemini',
    local: false,
    keyEnv: 'GOOGLE_API_KEY',
    keyPrefix: 'AIza',
    keyUrl: 'https://aistudio.google.com/apikey',
    structured: 'jsonSchema',
    imageTokens: IMAGE_TOKENS_GENEROUS,
    promptCache: false,
    timeoutMs: TIMEOUT_MS,
    models: builtIn('google'),
    create: ({ name, maxTokens, apiKey }) => new ChatGoogleGenerativeAI({
      model: name,
      maxOutputTokens: maxTokens,
      apiKey,
      maxRetries: 0,
    }),
    // Google risponde 400 (API_KEY_INVALID) a una chiave sbagliata.
    verify: (apiKey) => probe(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      { 'x-goog-api-key': apiKey }, [400, 401, 403],
    ),
    // Google non dà la data: l'ordine resta quello dell'elenco. Solo i modelli che generano testo.
    listModels: async (apiKey) => {
      const body = await fetchJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { 'x-goog-api-key': apiKey });
      return body?.models
        ?.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => ({ id: m.name.replace(/^models\//, ''), name: m.displayName })) ?? null;
    },
  },
  mistral: {
    label: 'Mistral',
    local: false,
    keyEnv: 'MISTRAL_API_KEY',
    keyUrl: 'https://console.mistral.ai/api-keys',
    // Il pacchetto LangChain di Mistral non passa lo schema nativo: chiamata a funzione forzata.
    structured: 'functionCalling',
    imageTokens: IMAGE_TOKENS_GENEROUS,
    promptCache: false,
    timeoutMs: TIMEOUT_MS,
    models: builtIn('mistral'),
    create: ({ name, maxTokens, apiKey }) => new ChatMistralAI({
      model: name,
      maxTokens,
      apiKey,
      maxRetries: 0,
      // LangChain manda 0,7 se non si dice altro: troppo per estrarre dati e scegliere categorie.
      temperature: 0.3,
    }),
    verify: (apiKey) => probe('https://api.mistral.ai/v1/models', { Authorization: `Bearer ${apiKey}` }),
    listModels: async (apiKey) => {
      const body = await fetchJson('https://api.mistral.ai/v1/models', { Authorization: `Bearer ${apiKey}` });
      return body?.data
        ?.filter((m) => m.capabilities?.completion_chat !== false && !m.deprecation)
        .map((m) => ({ id: m.id, name: m.name, created: (m.created ?? 0) * 1000 })) ?? null;
    },
  },
  ollama: {
    label: 'Ollama',
    local: true,
    // Ollama passa lo schema al campionamento: anche un modello piccolo produce JSON valido.
    structured: 'jsonSchema',
    imageTokens: IMAGE_TOKENS_GENEROUS,
    promptCache: false,
    timeoutMs: LOCAL_TIMEOUT_MS,
    models: [],
    create: ({ name, maxTokens, effort, baseUrl }) => new ChatOllama({
      model: name,
      baseUrl,
      numCtx: OLLAMA_NUM_CTX,
      numPredict: maxTokens,
      // Effort basso = niente ragionamento. Un modello che ragiona (qwen3, deepseek-r1) spende
      // altrimenti 1-2.000 token su uno scontrino e può finire il limite senza rispondere.
      // `false` lo accettano tutti i modelli; `true` lo rifiuta chi non sa ragionare, quindi negli
      // altri casi si lascia il comportamento del modello.
      ...(effort === 'low' ? { think: false } : {}),
    }),
    verify: async (baseUrl) => ({ valid: (await ollamaModels(baseUrl)) !== null }),
  },
};

/** I fornitori a pagamento, nell'ordine dell'interfaccia. */
export const CLOUD_PROVIDERS = Object.keys(PROVIDERS).filter((id) => !PROVIDERS[id].local);

/**
 * @param {string|null|undefined} spec - "fornitore:nome".
 * @returns {{ spec: string, provider: string, name: string } | null}
 */
export function parseModelSpec(spec) {
  const m = /^([a-z0-9-]+):(.+)$/.exec(spec?.trim() || '');
  return m ? { spec: `${m[1]}:${m[2]}`, provider: m[1], name: m[2] } : null;
}

/** @returns {Provider|null} */
export const providerOf = (parsed) => (parsed && Object.hasOwn(PROVIDERS, parsed.provider) ? PROVIDERS[parsed.provider] : null);

/** @returns {Provider|null} */
export const providerById = (id) => (Object.hasOwn(PROVIDERS, id) ? PROVIDERS[id] : null);

/** Un nome di modello Ollama ben formato: quale sia installato lo dice Ollama al momento. */
export const isOllamaName = (name) => OLLAMA_NAME_RE.test(name);

/**
 * Un nome di modello per un fornitore a pagamento, scritto dall'utente: lettere, cifre, punti,
 * trattini e barre, come «gpt-6-luna» o «mistral-medium-2604».
 */
export const isCloudModelName = (name) => /^[a-zA-Z0-9][\w.\-/]{0,99}$/.test(name);

/** @returns {{ id: string, label: string, local: boolean, keyEnv: string|null, keyPrefix: string|null, keyUrl: string|null, models: string[] }[]} Per il menu. */
export const providerCatalog = () =>
  Object.entries(PROVIDERS).map(([id, p]) => ({
    id, label: p.label, local: p.local, keyEnv: p.keyEnv ?? null, keyPrefix: p.keyPrefix ?? null, keyUrl: p.keyUrl ?? null, models: p.models,
  }));
