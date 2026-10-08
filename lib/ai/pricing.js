/**
 * @fileoverview Prezzi dei modelli e calcolo del costo di una chiamata.
 * @module lib/ai/pricing
 *
 * Prezzi in dollari per milione di token, dalla pagina ufficiale
 * https://platform.claude.com/docs/en/about-claude/pricing (verificati l'8 ottobre 2026).
 * Se Anthropic li cambia, vanno aggiornati qui: il tetto di spesa si basa su questa tabella.
 *
 * I costi si tengono in **micro-dollari interi** (1 $ = 1.000.000 µ$). Con i prezzi espressi per
 * milione di token il conto torna da solo: token × ($/MTok) = µ$. Gli interi evitano che la
 * somma di migliaia di frazioni accumuli errori di arrotondamento nel contatore mensile.
 */

/**
 * @typedef {Object} Rates
 * @property {number} input       - $/MTok per i token in ingresso.
 * @property {number} output      - $/MTok per i token in uscita (ragionamento compreso).
 * @property {number} cacheWrite  - $/MTok per la scrittura in cache (durata 5 minuti).
 * @property {number} cacheRead   - $/MTok per la lettura dalla cache.
 */

/**
 * @typedef {Rates & { effort: boolean, longContext?: Rates & { above: number } }} ModelPrice
 * `effort`: il modello accetta il parametro effort (Haiku 4.5 no, e lo rifiuterebbe con un 400).
 * `longContext`: tariffe diverse oltre una certa lunghezza del prompt (oggi solo Haiku 5.5).
 */

/** @type {Object<string, ModelPrice>} */
export const PRICES = {
  'claude-haiku-5-5': {
    input: 0.10, output: 0.50, cacheWrite: 0.125, cacheRead: 0.01, effort: true,
    longContext: { above: 100_000, input: 0.50, output: 2.50, cacheWrite: 0.625, cacheRead: 0.05 },
  },
  'claude-haiku-4-5': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10, effort: false },
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10, effort: false },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.10, effort: true },
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.20, effort: true },
};

/** @returns {boolean} true se il modello accetta il parametro effort. */
export const supportsEffort = (model) => PRICES[model]?.effort === true;

/** @returns {boolean} true se il modello ha un prezzo noto (gli altri vengono rifiutati). */
export const hasPrice = (model) => Object.hasOwn(PRICES, model);

/**
 * Tariffe da applicare a un prompt di quella lunghezza.
 * @param {string} model
 * @param {number} promptTokens - Ingresso totale, cache comprese.
 * @returns {Rates}
 */
function ratesFor(model, promptTokens) {
  const price = PRICES[model];
  if (!price) throw new Error(`Modello senza prezzo noto: ${model}`);
  return price.longContext && promptTokens > price.longContext.above ? price.longContext : price;
}

/**
 * Costo effettivo di una chiamata, dai contatori che l'API restituisce in `usage`.
 *
 * @param {string} model
 * @param {{ input_tokens?: number, output_tokens?: number,
 *           cache_creation_input_tokens?: number, cache_read_input_tokens?: number }} usage
 * @returns {number} micro-dollari, arrotondati per eccesso.
 */
export function costMicroUsd(model, usage) {
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const r = ratesFor(model, input + cacheWrite + cacheRead);
  return Math.ceil(input * r.input + output * r.output + cacheWrite * r.cacheWrite + cacheRead * r.cacheRead);
}

/**
 * Costo massimo possibile di una chiamata, da prenotare prima di farla: l'ingresso stimato per
 * eccesso e tutti i `max_tokens` in uscita, che sono un limite rigido (il ragionamento del
 * modello ci rientra).
 *
 * @param {string} model
 * @param {number} maxInputTokens
 * @param {number} maxOutputTokens
 * @returns {number} micro-dollari.
 */
export function maxCostMicroUsd(model, maxInputTokens, maxOutputTokens) {
  const r = ratesFor(model, maxInputTokens);
  // Una scrittura in cache costa più dell'ingresso normale: si prende la tariffa più alta.
  return Math.ceil(maxInputTokens * Math.max(r.input, r.cacheWrite) + maxOutputTokens * r.output);
}

/**
 * Margine per ciò che l'API aggiunge al prompt e che non passa da qui: le istruzioni di sistema
 * degli output strutturati e la formattazione dei messaggi. Le centinaia di token documentate
 * per i tool stanno largamente dentro questo margine.
 */
export const PROMPT_OVERHEAD_TOKENS = 2_000;

/**
 * Stima per eccesso dei token in ingresso: i byte UTF-8 del testo inviato più il margine.
 *
 * Il tokenizer lavora sui byte e ogni token copre almeno un byte, quindi i token di un testo non
 * superano mai i suoi byte. In pratica la stima è 3-4 volte il valore vero: va bene, perché la
 * prenotazione dura solo il tempo della chiamata. Contare i token esatti richiederebbe una
 * chiamata in più all'endpoint di conteggio a ogni richiesta.
 *
 * @param {...string} parts - System prompt, messaggio, schema serializzato.
 * @returns {number}
 */
export function inputTokensUpperBound(...parts) {
  return parts.reduce((sum, p) => sum + Buffer.byteLength(p || '', 'utf8'), 0) + PROMPT_OVERHEAD_TOKENS;
}

/** @returns {number} micro-dollari convertiti in dollari, per la visualizzazione. */
export const microToUsd = (micro) => micro / 1_000_000;
