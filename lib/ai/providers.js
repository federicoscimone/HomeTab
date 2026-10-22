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
