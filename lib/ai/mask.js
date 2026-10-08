/**
 * @fileoverview Mascheramento dei dati personali prima di ogni invio a un modello esterno.
 * @module lib/ai/mask
 *
 * Le causali bancarie contengono numeri di carta (anche parziali), IBAN, codici fiscali, email,
 * telefoni e nomi di chi riceve o manda un bonifico. Al modello servono esercente, luogo e tipo
 * di operazione, non questi: si sostituiscono con un segnaposto che dice cosa c'era.
 *
 * Limite noto: un nome di persona si riconosce solo dopo le diciture tipiche dei bonifici
 * («a favore di», «ordinante»…). Un nome scritto altrove passa così com'è.
 */

const RULES = [
  // Email prima delle sequenze di cifre, che potrebbero comparire nella parte locale.
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[EMAIL]'],
  // IBAN di seguito: due lettere, due cifre di controllo, 11-30 caratteri alfanumerici.
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi, '[IBAN]'],
  // IBAN a gruppi di quattro, l'ultimo eventualmente più corto. Contare i gruppi evita di
  // inghiottire la parola che segue, come faceva un singolo spazio facoltativo fra i caratteri.
  [/\b[A-Z]{2}\d{2}(?: [A-Z0-9]{4}){2,7}(?: [A-Z0-9]{1,3})?\b/gi, '[IBAN]'],
  // Codice fiscale di persona fisica.
  [/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi, '[CF]'],
  // Numero di carta intero, con o senza separatori (13-19 cifre).
  [/\b\d(?:[ -]?\d){12,18}\b/g, '[CARTA]'],
  // Carta mascherata dalla banca: «**** 1234», «XXXX-XXXX-XXXX-1234».
  [/(?:[*X]{4}[ -]?){1,3}\d{4}\b/gi, '[CARTA]'],
  // Numero dopo la parola carta/card, anche parziale: «CARTA 782872», «CARD N. 1234».
  [/\b(CARTA|CARD)(\s+(?:N\.?|NR\.?|NUM\.?)?\s*)\d{4,}/gi, '$1$2[NUM]'],
  // Qualsiasi altra sequenza di almeno 6 cifre: telefoni, conti, codici di riferimento.
  [/\d{6,}/g, '[NUM]'],
];

/**
 * Parole che aprono la causale vera e propria: lì il nome è finito, e sono proprio le parole
 * che servono a categorizzare il movimento.
 */
const REASON_WORDS = 'CAUSALE|RIF|NOTE|ID|CRO|TRN|SEPA|AFFITTO|CANONE|RATA|STIPENDIO|RIMBORSO|'
  + 'SALDO|ACCONTO|FATTURA|QUOTA|REGALO|SPESE|PAGAMENTO|PER';

/**
 * Diciture dopo cui, nei bonifici, compare un nome di persona. Il nome si sostituisce fino a
 * tre parole, fermandosi a cifre, punteggiatura o a una parola della causale.
 */
const NAME_AFTER = new RegExp(
  String.raw`\b(A\s+FAVORE\s+DI|A\s+FAVORE|FAVORE\s+DI|BENEFICIARIO|ORDINANTE|DISPOSTO\s+DA|DA\s+PARTE\s+DI|BONIFICO\s+(?:A|DA|DI)\b(?!\s+FAVORE))([:\s]+)`
  + String.raw`((?:(?!(?:${REASON_WORDS})\b)\p{L}[\p{L}'’.-]*\s*){1,3})`,
  'giu',
);

/**
 * @param {string|null|undefined} text
 * @returns {string} Il testo con i dati personali sostituiti da segnaposto.
 *
 * @example
 * maskText('PAGAMENTO POS CARTA 782872 IKEA CATANIA'); // 'PAGAMENTO POS CARTA [NUM] IKEA CATANIA'
 */
export function maskText(text) {
  if (!text) return '';
  let out = String(text);
  for (const [re, replacement] of RULES) out = out.replace(re, replacement);
  out = out.replace(NAME_AFTER, (_, lead, sep, name) => `${lead}${sep}[NOME]${/\s$/.test(name) ? ' ' : ''}`);
  return out.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Applica maskText ai campi di testo indicati di un oggetto, senza modificarlo.
 * @template T
 * @param {T} obj
 * @param {string[]} fields
 * @returns {T}
 */
export function maskFields(obj, fields) {
  const copy = { ...obj };
  for (const f of fields) if (typeof copy[f] === 'string') copy[f] = maskText(copy[f]);
  return copy;
}
