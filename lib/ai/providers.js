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
import { hasPrice, supportsEffort } from './pricing.js';

/** Oltre questo tempo la chiamata si abbandona; l'esito resta incerto e si conta come spesa. */
const TIMEOUT_MS = 90_000;

/**
 * @typedef {Object} Provider
 * @property {() => boolean} configured   - Le credenziali ci sono.
 * @property {boolean} local              - Gira in casa: costo zero, nessun tetto da applicare.
 * @property {(name: string) => boolean} knows - Il modello ha un prezzo noto (o è locale).
 * @property {(opts: { name: string, maxTokens: number, effort?: string }) =>
 *   import('@langchain/core/language_models/chat_models').BaseChatModel} create
 */

/** @type {Object<string, Provider>} */
const PROVIDERS = {
  anthropic: {
    configured: () => Boolean(process.env.ANTHROPIC_API_KEY),
    local: false,
    knows: hasPrice,
    create: ({ name, maxTokens, effort }) => new ChatAnthropic({
      model: name,
      maxTokens,
      apiKey: process.env.ANTHROPIC_API_KEY,
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
