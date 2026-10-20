/**
 * @fileoverview Fornitori di modelli, tutti attraverso LangChain.
 * @module lib/ai/providers
 *
 * Un modello si indica come "fornitore:nome", per esempio `anthropic:claude-haiku-5-5`. Ogni
 * fornitore restituisce un chat model di LangChain, quindi il resto del codice non sa quale
 * modello sta usando: per aggiungerne uno (OpenAI, Ollama in locale…) si installa il suo pacchetto
 * `@langchain/<fornitore>` e si aggiunge una voce qui.
 *
 * Un registro esplicito invece di `initChatModel`: quello importa i pacchetti dei fornitori a
 * partire da una stringa, e il bundler di Next dovrebbe risolverli tutti in fase di build, anche
 * quelli non installati.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { PRICES, hasPrice, supportsEffort } from './pricing.js';

/** Oltre questo tempo la chiamata si abbandona; l'esito resta incerto e si conta come spesa. */
const TIMEOUT_MS = 90_000;

/**
 * @typedef {Object} Provider
 * @property {string} label               - Nome per l'interfaccia.
 * @property {boolean} needsKey           - Serve una chiave API (i modelli locali no).
 * @property {boolean} local              - Gira in casa: costo zero, nessun tetto da applicare.
 * @property {(name: string) => boolean} knows - Il modello ha un prezzo noto (o è locale).
 * @property {string[]} models            - Modelli proposti nel menu delle impostazioni.
 * @property {(opts: { name: string, maxTokens: number, effort?: string, apiKey: string }) =>
 *   import('@langchain/core/language_models/chat_models').BaseChatModel} create
 */

/** @type {Object<string, Provider>} */
const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    needsKey: true,
    local: false,
    knows: hasPrice,
    // Le versioni con la data sono alias di quelle senza: nel menu basta una voce.
    models: Object.keys(PRICES).filter((m) => !/-\d{8}$/.test(m)),
    create: ({ name, maxTokens, effort, apiKey }) => new ChatAnthropic({
      model: name,
      maxTokens,
      apiKey,
      // Solo per le prove contro un'API finta; in produzione resta quella di Anthropic.
      anthropicApiUrl: process.env.ANTHROPIC_BASE_URL || undefined,
      // Nessuna ripetizione automatica, né di LangChain (6 di default) né dell'SDK (2): una
      // richiesta andata in timeout può essere stata elaborata e addebitata, e ripeterla la
      // pagherebbe due volte fuori dalla prenotazione. Riprova l'utente, consapevolmente.
      maxRetries: 0,
      clientOptions: { maxRetries: 0, timeout: TIMEOUT_MS },
      ...(effort && supportsEffort(name) ? { outputConfig: { effort } } : {}),
    }),
  },
};

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

/** @returns {{ id: string, label: string, needsKey: boolean, models: string[] }[]} Per il menu. */
export const providerCatalog = () =>
  Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, needsKey: p.needsKey, models: p.models }));
