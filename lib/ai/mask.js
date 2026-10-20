/**
 * @fileoverview Mascheramento dei dati personali prima di ogni invio a un modello esterno.
 * @module lib/ai/mask
 *
 * Le causali bancarie contengono numeri di carta (anche parziali), IBAN, codici fiscali, email,
 * telefoni e nomi di persone. Al modello servono esercente, luogo e tipo di operazione, non
 * questi: si sostituiscono con un segnaposto che dice cosa c'era.
 *
 * Tre livelli:
 * 1. `maskText`, su qualsiasi testo: identificativi (carte, IBAN, CF, email, numeri lunghi o dopo
 *    «N.», «CC», «*»), nomi dopo le diciture dei bonifici e cognomi dopo un titolo («DR ROSSI»).
 * 2. `maskRow`, su una riga intera: se è un **movimento tra persone** (bonifico, giroconto,
 *    Satispay, PayPal, ricarica…), la colonna dell'esercente si invia solo se ha l'aria di
 *    un'attività (BAR, FARMACIA, SRL…), e nella causale si maschera il nome che segue la dicitura
 *    del trasferimento. Il nome della controparte è proprio ciò che quelle righe contengono.
 * 3. Chi chiama sceglie quali campi inviare: date, note e dati del conto non partono mai.
 *
 * È una minimizzazione, non un'anonimizzazione: esercenti e importi restano, perché servono a
 * categorizzare. Le regole sono euristiche: il pulsante «Vedi cosa viene inviato» nella revisione
 * dell'import e `scripts/mask-preview.js` servono a provarle sui propri estratti conto.
 */

/** Parole che indicano un'attività e non una persona. */
const BUSINESS_WORDS = [
  'SPA', 'S\\.P\\.A', 'SRL', 'SRLS', 'S\\.R\\.L', 'SNC', 'SAS', 'SCARL', 'SCRL', 'COOP', 'COOPERATIVA',
  'ONLUS', 'SOCIETA', 'SOC', 'STUDIO', 'BAR', 'CAFFE', 'CAFFÈ', 'PASTICCERIA', 'PANETTERIA', 'PANIFICIO',
  'FORNO', 'RISTORANTE', 'PIZZERIA', 'TRATTORIA', 'OSTERIA', 'GELATERIA', 'MACELLERIA', 'PESCHERIA',
  'FARMACIA', 'PARAFARMACIA', 'SUPERMERCATO', 'MARKET', 'MINIMARKET', 'ALIMENTARI', 'SHOP', 'STORE',
  'NEGOZIO', 'HOTEL', 'ALBERGO', 'AGENZIA', 'ASSICURAZIONI', 'ASSICURAZIONE', 'BANCA', 'CONDOMINIO',
  'AMMINISTRAZIONE', 'SCUOLA', 'ASILO', 'UNIVERSITA', 'ASSOCIAZIONE', 'CIRCOLO', 'PALESTRA', 'CLINICA',
  'OSPEDALE', 'CENTRO', 'COMUNE', 'REGIONE', 'ENTRATE', 'TABACCHI', 'EDICOLA', 'LIBRERIA', 'OTTICA',
  'AUTOFFICINA', 'OFFICINA', 'GARAGE', 'PARRUCCHIERE', 'ESTETICA', 'LAVANDERIA', 'VETERINARIO',
  'VETERINARIA', 'AMBULATORIO', 'LABORATORIO', 'DISTRIBUTORE', 'STAZIONE', 'SERVIZI', 'GROUP',
  'ITALIA', 'INTERNATIONAL', 'LTD', 'GMBH', 'INC', 'SA',
];
const BUSINESS_RE = new RegExp(`(^|[^\\p{L}])(${BUSINESS_WORDS.join('|')})(?=$|[^\\p{L}])`, 'iu');

/** @returns {boolean} true se il testo contiene una parola da attività commerciale. */
export const looksLikeBusiness = (text) => BUSINESS_RE.test(text || '');

/**
 * Parole che aprono la causale vera e propria: lì il nome è finito, e sono proprio le parole
 * che servono a categorizzare il movimento.
 */
const REASON_WORDS = [
  'CAUSALE', 'RIF', 'NOTE', 'ID', 'CRO', 'TRN', 'SEPA', 'AFFITTO', 'CANONE', 'RATA', 'STIPENDIO',
  'RIMBORSO', 'SALDO', 'ACCONTO', 'FATTURA', 'QUOTA', 'REGALO', 'SPESE', 'PAGAMENTO', 'PER',
  'BOLLETTA', 'CONDOMINIALE', 'ISCRIZIONE', 'RETTA', 'CAPARRA', 'PENSIONE', 'EMOLUMENTI',
];

/** Diciture dei trasferimenti tra persone. */
const TRANSFER_WORDS = [
  'BONIFICO', 'BONIFICI', 'BONIF', 'GIROCONTO', 'GIROFONDO', 'GIRO', 'RICARICA', 'POSTEPAY', 'PAYPAL',
  'SATISPAY', 'TRASFERIMENTO', 'INVIO', 'SCT', 'ORDINANTE', 'BENEFICIARIO', 'P2P', 'BONIFICOISTANTANEO',
];
const TRANSFER_RE = new RegExp(`(^|[^\\p{L}])(${TRANSFER_WORDS.join('|')})(?=$|[^\\p{L}])`, 'iu');

/** @returns {boolean} true se la riga descrive un trasferimento di denaro, spesso tra persone. */
export const looksLikeTransfer = (text) => TRANSFER_RE.test(text || '');

/** Parole di servizio dei trasferimenti: fra la dicitura e il nome, si saltano. */
const OP_WORDS = new Set([
  'A', 'DA', 'DI', 'DEL', 'DELLA', 'AL', 'ALLA', 'IN', 'SU', 'VS', 'NS', 'FAVORE', 'ENTRATA', 'USCITA',
  'ISTANTANEO', 'ISTANTANEA', 'ESTERO', 'ITALIA', 'DISPOSTO', 'RICEVUTO', 'ESEGUITO', 'DENARO', 'INVIATO',
  'RICEVUTA', 'ONLINE', 'APP', 'WEB', 'CC', 'C/C', 'CONTO', 'CARTA', 'PREPAGATA', 'EVOLUTION', 'TRAMITE',
  'MEZZO', 'BANCOMAT', 'PAY', 'DEPOSITO', 'RISPARMIO', 'PROPRIO', 'MIO', 'NOSTRO', 'COINTESTATO', 'BONIFICO', 'DEBITO', 'CREDITO', 'ADDEBITO', 'ACCREDITO', 'OPERAZIONE', 'N', 'NR',
]);
const REASON_SET = new Set(REASON_WORDS);
const TRANSFER_SET = new Set(TRANSFER_WORDS);

const TITLES = 'DR|DOTT|DOTTSSA|DOTT\\.SSA|DOTTORESSA|AVV|ING|GEOM|ARCH|PROF|SIG|SIGRA|SIG\\.RA|SIGG|RAG|NOTAIO';

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
  // Ultime cifre di carte e conti: «*1234», «CC 4521», «C/C 4521», «N. 12345», «RIF 8812».
  [/(\*+\s?|\b(?:N|NR|NUM|CC|C\/C|CONTO|RIF|ID|CRO|TRN|PRAT|PRATICA)\.?:?\s*)\d{4,5}\b/gi, '$1[NUM]'],
  // Qualsiasi altra sequenza di almeno 6 cifre: telefoni, conti, codici di riferimento.
  [/\d{6,}/g, '[NUM]'],
];

/** Un token che potrebbe essere un nome: solo lettere, non una parola nota. */
function nameLike(token) {
  const word = token.replace(/^\*+/, '').replace(/[.,:;]+$/, '');
  if (!/^\p{L}[\p{L}'’.-]*$/u.test(word) || word.length < 2) return false;
  const up = word.toUpperCase();
  return !OP_WORDS.has(up) && !REASON_SET.has(up) && !TRANSFER_SET.has(up) && !looksLikeBusiness(up);
}

const isReasonOrBusiness = (token) => {
  const up = token.replace(/[.,:;]+$/, '').toUpperCase();
  return REASON_SET.has(up) || looksLikeBusiness(up);
};

/** Parole che non possono far parte di un nome: preposizioni, causale, attività. */
const NOT_A_NAME = ['DI', 'DA', 'DEL', 'DELLA', 'A', 'AL', 'ALLA', ...REASON_WORDS, ...BUSINESS_WORDS].join('|');

/**
 * Nome dopo le diciture dei bonifici, fino a quattro parole, fermandosi a cifre, punteggiatura o
 * a una parola della causale o di un'attività: «A FAVORE DI STUDIO DENTISTICO» non è un nome.
 */
const NAME_AFTER = new RegExp(
  String.raw`\b(A\s+FAVORE\s+DI|A\s+FAVORE|FAVORE\s+DI|BENEFICIARIO|ORDINANTE|DISPOSTO\s+DA|DA\s+PARTE\s+DI|RICEVUTO\s+DA|INVIATO\s+A|BONIFICO\s+(?:A|DA|DI)\b(?!\s+FAVORE))([:\s]+)`
  + String.raw`((?:(?!(?:${NOT_A_NAME})(?:$|[^\p{L}]))\p{L}[\p{L}'’.-]*\s*){1,4})`,
  'giu',
);

/** Cognome (e al massimo un nome) dopo un titolo: «DR ROSSI», «AVV. MARIA BIANCHI». */
const AFTER_TITLE = new RegExp(
  String.raw`\b(${TITLES})(\.?\s+)((?:(?!(?:${NOT_A_NAME})(?:$|[^\p{L}]))\p{L}[\p{L}'’-]*\s*){1,2})`,
  'giu',
);

const keepTrailingSpace = (s) => (/\s$/.test(s) ? ' ' : '');

/**
 * @param {string|null|undefined} text
 * @returns {string} Il testo con identificativi e nomi riconoscibili sostituiti da segnaposto.
 *
 * @example
 * maskText('PAGAMENTO POS CARTA 782872 IKEA CATANIA'); // 'PAGAMENTO POS CARTA [NUM] IKEA CATANIA'
 */
export function maskText(text) {
  if (!text) return '';
  let out = String(text);
  for (const [re, replacement] of RULES) out = out.replace(re, replacement);
  out = out.replace(NAME_AFTER, (_, lead, sep, name) => `${lead}${sep}[NOME]${keepTrailingSpace(name)}`);
  out = out.replace(AFTER_TITLE, (_, title, sep, name) => `${title}${sep}[NOME]${keepTrailingSpace(name)}`);
  return out.replace(/\s{2,}/g, ' ').trim();
}

/**
 * In una causale di trasferimento, il primo gruppo di parole simili a un nome dopo la dicitura
 * («SATISPAY GIULIA ROSSI», «RICARICA POSTEPAY A MARIO ROSSI») diventa [NOME]. Ci si ferma alla
 * prima parola della causale o di un'attività: «BONIFICO IN ENTRATA RIMBORSO SPESE» resta com'è.
 */
function maskCounterparty(text) {
  const tokens = text.split(/(\s+)/);
  let afterTransfer = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (!tok.trim()) continue;
    const up = tok.replace(/[.,:;]+$/, '').toUpperCase();
    if (TRANSFER_SET.has(up)) { afterTransfer = true; continue; }
    if (!afterTransfer) continue;
    if (OP_WORDS.has(up)) continue;
    if (isReasonOrBusiness(tok) || !nameLike(tok)) { afterTransfer = false; continue; }
    // Un gruppo di parole-nome consecutive diventa un solo segnaposto.
    let j = i;
    while (j + 2 < tokens.length && nameLike(tokens[j + 2])) j += 2;
    tokens.splice(i, j - i + 1, `${tok.startsWith('*') ? '*' : ''}[NOME]`);
    afterTransfer = false;
  }
  return tokens.join('').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Maschera una riga intera, tenendo conto del tipo di operazione.
 *
 * @param {{ description?: string, payee?: string, place?: string }} row
 * @returns {{ description: string, payee: string, place: string, transfer: boolean }}
 *   `transfer`: la riga è un trasferimento di denaro, trattato con le regole più strette.
 */
export function maskRow(row) {
  const transfer = looksLikeTransfer(`${row.description || ''} ${row.payee || ''}`);
  let description = maskText(row.description);
  let payee = maskText(row.payee);
  if (transfer) {
    description = maskCounterparty(description);
    // Nella colonna dell'esercente di un trasferimento c'è quasi sempre la controparte: si invia
    // solo se ha l'aria di un'attività. Le regole per parola chiave lavorano sul testo originale,
    // in locale, quindi gli esercenti noti (PAYPAL *NETFLIX…) sono già categorizzati prima.
    if (payee && !looksLikeBusiness(payee) && payee.split(/\s+/).some(nameLike)) payee = '[NOME]';
  }
  return { description, payee, place: maskText(row.place), transfer };
}

/**
 * Maschera le celle di testo di una riga di cui non si sa quale colonna sia l'esercente: serve
 * alla proposta di template, che vede un file mai visto prima. Stesse regole di `maskRow`: in un
 * trasferimento, la cella con la dicitura perde il nome che segue, e ogni altra cella con l'aria
 * di un nome (e non di un'attività) diventa [NOME].
 *
 * @param {string[]} cells - Solo le celle di testo (date e importi restano fuori).
 * @returns {string[]}
 */
export function maskTextCells(cells) {
  const transfer = looksLikeTransfer(cells.join(' '));
  return cells.map((cell) => {
    const m = maskText(cell);
    if (!transfer || !m) return m;
    if (looksLikeTransfer(cell)) return maskCounterparty(m);
    return !looksLikeBusiness(m) && m.split(/\s+/).some(nameLike) ? '[NOME]' : m;
  });
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
