/**
 * @fileoverview Prezzi dei modelli e calcolo del costo di una chiamata.
 * @module lib/ai/pricing
 *
 * Prezzi in dollari per milione di token, dalle pagine ufficiali dei fornitori, verificati il
 * 22 ottobre 2026:
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - OpenAI: https://developers.openai.com/api/docs/pricing
 * - Google: https://ai.google.dev/gemini-api/docs/pricing
 * - Mistral: https://docs.mistral.ai/models/mistral-small-4-0-26-03
 * Qui ci sono solo i modelli consigliati, ed è il punto di partenza: «Aggiorna i prezzi» rilegge
 * le pagine ufficiali e salva i prezzi nuovi (AiSettings.priceOverrides), e qualsiasi altro
 * modello si aggiunge a mano con il suo prezzo (AiSettings.customModels). Il tetto di spesa si
 * basa su questi numeri.
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
 * @typedef {Rates & { provider: string, effort: boolean, webSearch?: string,
 *   longContext?: Rates & { above: number }, changes?: (Partial<Rates> & { from: string })[] }} ModelPrice
 * `provider`: il fornitore che serve il modello (lib/ai/providers.js).
 * `effort`: il modello accetta un livello di ragionamento (Haiku 4.5 no, e rifiuterebbe il
 *   parametro con un 400).
 * `webSearch`: la versione dello strumento di ricerca web che funziona davvero con il modello.
 *   Su Haiku 5.5 la versione con filtro dinamico (_20260209) addebita le ricerche ma il modello
 *   non ne vede i risultati (provato il 20 ottobre 2026): si usa quella di base.
 * `longContext`: tariffe diverse oltre una certa lunghezza del prompt.
 * `changes`: variazioni già annunciate, in vigore dal giorno `from` (AAAA-MM-GG).
 *
 * Senza cache esplicita (OpenAI, Google, Mistral la fanno da soli o non la fanno) la scrittura
 * costa come l'ingresso normale.
 */

/** @type {Object<string, ModelPrice>} */
export const PRICES = {
  'claude-haiku-5-5': {
    provider: 'anthropic', input: 0.10, output: 0.50, cacheWrite: 0.125, cacheRead: 0.01, effort: true, webSearch: 'web_search_20250305',
    longContext: { above: 100_000, input: 0.50, output: 2.50, cacheWrite: 0.625, cacheRead: 0.05 },
  },
  'claude-haiku-4-5': { provider: 'anthropic', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10, effort: false, webSearch: 'web_search_20250305' },
  'claude-haiku-4-5-20251001': { provider: 'anthropic', input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10, effort: false, webSearch: 'web_search_20250305' },
  'claude-sonnet-5-5': { provider: 'anthropic', input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.10, effort: true, webSearch: 'web_search_20260209' },
  'claude-opus-5-5': { provider: 'anthropic', input: 4, output: 20, cacheWrite: 5, cacheRead: 0.20, effort: true, webSearch: 'web_search_20260209' },

  // Oltre 272.000 token in ingresso le tariffe salgono; HomeTab non ci arriva, ma il conto resta giusto.
  'gpt-6-luna': {
    provider: 'openai', input: 0.10, output: 0.50, cacheWrite: 0.10, cacheRead: 0.01, effort: true,
    longContext: { above: 272_000, input: 0.20, output: 0.75, cacheWrite: 0.20, cacheRead: 0.02 },
  },
  'gpt-6.1-sol': {
    provider: 'openai', input: 2, output: 10, cacheWrite: 2, cacheRead: 0.10, effort: true,
    longContext: { above: 272_000, input: 4, output: 15, cacheWrite: 4, cacheRead: 0.20 },
  },

  // Google ha già annunciato i rincari: la tabella li applica da sola dal giorno indicato.
  'gemini-3.5-flash-lite': { provider: 'google', input: 0.30, output: 2.50, cacheWrite: 0.30, cacheRead: 0.03, effort: false },
  'gemini-3.8-flash': {
    provider: 'google', input: 0.75, output: 3.75, cacheWrite: 0.75, cacheRead: 0.075, effort: false,
    changes: [{ from: '2027-01-01', input: 1.50, output: 7.50, cacheWrite: 1.50, cacheRead: 0.15 }],
  },
  'gemini-4-argon': {
    provider: 'google', input: 2, output: 10, cacheWrite: 2, cacheRead: 0.10, effort: false,
    changes: [{ from: '2026-12-01', input: 4, output: 20, cacheWrite: 4, cacheRead: 0.20 }],
  },

  // Mistral Small 4.
  'mistral-small-2603': { provider: 'mistral', input: 0.15, output: 0.60, cacheWrite: 0.15, cacheRead: 0.15, effort: false },
};

/** Il giorno in cui la tabella del codice è stata verificata: la prima riga dello storico. */
export const PRICES_VERIFIED_ON = '2026-10-22';

/** Una variazione annunciata, con i campi che mancano ricavati dal prezzo d'ingresso. */
const changeOf = ({ from, input, output, cacheRead }, writeRatio = 1, readRatio = 1) => ({
  from, input, output, cacheWrite: input * writeRatio, cacheRead: cacheRead ?? input * readRatio,
});

/**
 * Un modello aggiunto dall'interfaccia, con i prezzi scritti dall'utente o letti dalla pagina:
 * senza cache esplicita e senza effort, perché non si sa se il modello li accetta.
 *
 * @param {{ provider: string, input: number, output: number, cacheRead?: number|null,
 *   changes?: { from: string, input: number, output: number, cacheRead?: number|null }[] }} custom
 * @returns {ModelPrice}
 */
export const customPrice = ({ provider, input, output, cacheRead, changes }) => ({
  provider, input, output, cacheWrite: input, cacheRead: cacheRead ?? input, effort: false,
  changes: (changes ?? []).map((c) => changeOf(c)),
});

/**
 * Il prezzo della tabella aggiornato con quello letto dalla pagina ufficiale. Il resto della voce
 * (fornitore, effort, ricerca web, contesto lungo) resta quello del codice; la scrittura in cache
 * mantiene il rapporto con l'ingresso che ha nella tabella (1,25 per Anthropic). Le variazioni
 * annunciate sono quelle lette con il prezzo; se non ce ne sono, valgono quelle della tabella
 * successive all'aggiornamento.
 *
 * @param {ModelPrice} table
 * @param {{ input: number, output: number, cacheRead: number|null, updatedAt?: Date|string,
 *   changes?: object[] }} override
 * @returns {ModelPrice}
 */
export function refreshedPrice(table, { input, output, cacheRead, updatedAt, changes }) {
  const writeRatio = table.input > 0 ? table.cacheWrite / table.input : 1;
  const readRatio = table.input > 0 ? table.cacheRead / table.input : 1;
  const day = updatedAt ? new Date(updatedAt).toISOString().slice(0, 10) : '';
  return {
    ...table,
    input, output, cacheWrite: input * writeRatio, cacheRead: cacheRead ?? input * readRatio,
    changes: changes?.length
      ? changes.map((c) => changeOf(c, writeRatio, readRatio))
      : (table.changes ?? []).filter((c) => c.from > day),
  };
}

/** Il prezzo, da un nome della tabella o già risolto (modelli aggiunti dall'utente). */
const asPrice = (model) => (typeof model === 'string' ? (Object.hasOwn(PRICES, model) ? PRICES[model] : undefined) : model);

/** @returns {string|null} Lo strumento di ricerca web da usare con il modello, o null. */
export const webSearchTool = (model) => asPrice(model)?.webSearch ?? null;

/** Una ricerca web costa 10 $ ogni 1.000, cioè 10.000 µ$, oltre ai token dei risultati. */
export const WEB_SEARCH_MICRO = 10_000;
/**
 * Token in ingresso da prenotare per ogni ricerca: i risultati entrano nel prompt e la loro
 * lunghezza non si conosce prima. Misurati: 6-10.000 per ricerca; se ne prenotano 25.000.
 */
export const WEB_RESULT_TOKENS = 25_000;
/** Istruzioni che l'API aggiunge quando lo strumento è presente (misurate: circa 5.500 token). */
export const WEB_TOOL_OVERHEAD_TOKENS = 8_000;

/**
 * Costo tipico di una riga cercata sul web, per avvisare prima del clic: una ricerca, circa
 * 10.000 token di istruzioni e risultati, 300 in uscita. Misurato il 20 ottobre 2026: 1,1 centesimi
 * con Haiku 5.5, 3 con Sonnet 5.5.
 * @returns {number} micro-dollari.
 */
export function typicalWebRowMicro(model) {
  const r = asPrice(model);
  return r ? WEB_SEARCH_MICRO + Math.ceil(10_000 * r.input + 300 * r.output) : 0;
}

/** @returns {boolean} true se il modello accetta il parametro effort. */
export const supportsEffort = (model) => asPrice(model)?.effort === true;

/** @returns {boolean} true se il modello ha un prezzo noto (gli altri vengono rifiutati). */
export const hasPrice = (model) => Object.hasOwn(PRICES, model);

/**
 * Tariffe da applicare a un prompt di quella lunghezza, nel giorno della chiamata.
 * @param {string|ModelPrice} model - Nome della tabella o prezzo già risolto.
 * @param {number} promptTokens - Ingresso totale, cache comprese.
 * @param {Date} [now]
 * @returns {Rates}
 */
function ratesFor(model, promptTokens, now = new Date()) {
  const base = asPrice(model);
  if (!base) throw new Error(`Modello senza prezzo noto: ${model}`);
  const today = now.toISOString().slice(0, 10);
  const price = (base.changes ?? []).filter((c) => c.from <= today)
    .reduce((p, { from: _from, ...rates }) => ({
      ...p, ...Object.fromEntries(Object.entries(rates).filter(([, v]) => v !== null && v !== undefined)),
    }), base);
  return price.longContext && promptTokens > price.longContext.above ? price.longContext : price;
}

/** @returns {Rates} Le tariffe in vigore oggi per un prompt corto: quelle da mostrare nel menu. */
export const currentRates = (model, now = new Date()) => ratesFor(model, 0, now);

/**
 * Costo effettivo di una chiamata, dai contatori che l'API restituisce in `usage`.
 *
 * @param {string|ModelPrice} model
 * @param {{ input_tokens?: number, output_tokens?: number,
 *           cache_creation_input_tokens?: number, cache_read_input_tokens?: number }} usage
 * @returns {number} micro-dollari, arrotondati per eccesso.
 */
export function costMicroUsd(model, usage, now = new Date()) {
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const r = ratesFor(model, input + cacheWrite + cacheRead, now);
  return Math.ceil(input * r.input + output * r.output + cacheWrite * r.cacheWrite + cacheRead * r.cacheRead);
}

/**
 * Costo massimo possibile di una chiamata, da prenotare prima di farla: l'ingresso stimato per
 * eccesso e tutti i `max_tokens` in uscita, che sono un limite rigido (il ragionamento del
 * modello ci rientra).
 *
 * @param {string|ModelPrice} model
 * @param {number} maxInputTokens
 * @param {number} maxOutputTokens
 * @returns {number} micro-dollari.
 */
export function maxCostMicroUsd(model, maxInputTokens, maxOutputTokens, now = new Date()) {
  const r = ratesFor(model, maxInputTokens, now);
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
