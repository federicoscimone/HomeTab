import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoryIndex, lookupMerchant, merchantTokens } from '../lib/utils/merchantHistory.js';

test('parole significative: via circuiti, parole di servizio, cifre e segnaposto', () => {
  assert.deepEqual(merchantTokens('PAGAMENTO POS CARTA [NUM] ESSELUNGA MILANO 12'), ['ESSELUNGA', 'MILANO']);
  assert.deepEqual(merchantTokens('SUMUP *LA BOTTEGA DI SARA'), ['BOTTEGA', 'SARA']);
  assert.deepEqual(merchantTokens('PAYPAL *EBAY'), ['EBAY']);
  assert.deepEqual(merchantTokens('SQ *GIO 2'), ['GIO']);
  assert.deepEqual(merchantTokens(''), []);
});

const HISTORY = [
  { text: 'Esselunga', categoryId: 'spesa', subCategory1Id: 'super', count: 116 },
  { text: 'LA BOTTEGA DI SARA', categoryId: 'spesa', subCategory1Id: 'alimentari', count: 9 },
  { text: 'BAR LUCE MILANO', categoryId: 'cibo', subCategory1Id: 'bar', count: 30 },
  { text: 'FARMACIA MILANO CENTRO', categoryId: 'salute', subCategory1Id: 'farmacia', count: 12 },
  { text: 'OTTICA MILANO', categoryId: 'salute', subCategory1Id: 'ottica', count: 2 },
  { text: 'MARIO RISTORANTE', categoryId: 'cibo', subCategory1Id: 'ristorante', count: 3 },
  { text: 'MARIO RISTORANTE', categoryId: 'regali', subCategory1Id: null, count: 3 },
  { text: 'AMAZON', categoryId: 'shopping', subCategory1Id: null, count: 40 },
];
const index = buildHistoryIndex(HISTORY);

test('esercente riconosciuto per intero e storico concorde: categoria da sola', () => {
  const r = lookupMerchant(index, 'PAGAMENTO POS CARTA [NUM] ESSELUNGA VIALE MONZA');
  assert.deepEqual(r.match, { categoryId: 'spesa', subCategory1Id: 'super', support: 116, text: 'Esselunga' });
  const r2 = lookupMerchant(index, 'SUMUP *LA BOTTEGA DI SARA');
  assert.equal(r2.match.subCategory1Id, 'alimentari');
});

test('una parola comune in comune non basta: «MILANO» non è un esercente', () => {
  const r = lookupMerchant(index, 'PAGAMENTO POS CARTA [NUM] DECATHLON MILANO');
  assert.equal(r.match, null);
  assert.equal(r.similar.length, 0);
});

test('storico discorde: nessuna categoria automatica, ma entrambe come esempi', () => {
  const r = lookupMerchant(index, 'PAGAMENTO POS MARIO RISTORANTE');
  assert.equal(r.match, null);
  assert.deepEqual(r.similar.map((s) => s.categoryId).sort(), ['cibo', 'regali']);
});

test('riconoscimento parziale: esempio per il modello, non categoria automatica', () => {
  const r = lookupMerchant(index, 'PAGAMENTO POS BAR LUCE');
  // «BAR LUCE» è contenuto in «BAR LUCE MILANO»: per il testo più corto è pieno.
  assert.equal(r.match.subCategory1Id, 'bar');
  const r2 = lookupMerchant(index, 'PAGAMENTO POS FARMACIA SAN PAOLO');
  assert.equal(r2.match, null);
  assert.equal(r2.similar[0]?.categoryId, 'salute');
});

test('verso il modello va solo il testo mascherato con la riga intera', async () => {
  const { similarExamples } = await import('../lib/ai/tasks/categorize.js');
  const idx = buildHistoryIndex([
    // Bonifico salvato con il nome della persona come esercente: il nome serve alla ricerca locale…
    { text: 'GIUSEPPE VERDI', sendText: '[NOME]', categoryId: 'casa', subCategory1Id: 'affitto', count: 12 },
    { text: 'LA BOTTEGA DI SARA', sendText: 'LA BOTTEGA DI SARA', categoryId: 'spesa', subCategory1Id: null, count: 4 },
  ]);
  // …e funziona in locale…
  assert.equal(lookupMerchant(idx, 'BONIFICO A FAVORE DI GIUSEPPE VERDI').match.subCategory1Id, 'affitto');
  // …ma come esempio per il modello non parte.
  const codeOf = (c, s) => (s ? `${c}.${s}` : c);
  assert.deepEqual(similarExamples(idx, 'BONIFICO A FAVORE DI GIUSEPPE VERDI', codeOf), []);
  assert.deepEqual(similarExamples(idx, 'SUMUP *BOTTEGA SARA', codeOf), [{ text: 'LA BOTTEGA DI SARA', category: 'spesa' }]);
});

test('solo movimenti dello stesso tipo: un\'uscita non è uno stipendio', () => {
  const idx = buildHistoryIndex([
    { text: 'Azienda', type: 'income', categoryId: 'stipendio', subCategory1Id: null, count: 24 },
    ...HISTORY.map((h) => ({ ...h, type: 'expense' })),
  ]);
  assert.equal(lookupMerchant(idx, 'PAGAMENTO POS AZIENDA AGRICOLA BIO', 'expense').match, null);
  assert.equal(lookupMerchant(idx, 'BONIFICO DA AZIENDA', 'income').match.categoryId, 'stipendio');
});

test('nomi troncati dalla banca e piccoli errori di battitura', async () => {
  const { sameWord } = await import('../lib/utils/merchantHistory.js');
  assert.equal(sameWord('ESSELUNG', 'ESSELUNGA'), true);
  assert.equal(sameWord('MCDONALD', 'MCDONALDS'), true);
  assert.equal(sameWord('MCDONLADS', 'MCDONALDS'), true);
  assert.equal(sameWord('MCDONLDS', 'MCDONALDS'), true);
  assert.equal(sameWord('BAR', 'BARI'), false);
  assert.equal(sameWord('ROMA', 'ROMANO'), false);
  assert.equal(sameWord('FARMA', 'FARMACIA'), false);
  const idx = buildHistoryIndex(HISTORY);
  assert.equal(lookupMerchant(idx, 'PAGAMENTO POS ESSELUNG VIALE MONZA').match?.subCategory1Id, 'super');
});

test('categoria della banca: imparata dallo storico solo se concorde e con abbastanza movimenti', async () => {
  const { buildBankCategoryMap, lookupBankCategory } = await import('../lib/utils/bankCategoryMap.js');
  const map = buildBankCategoryMap([
    { label: 'Alimentari', type: 'expense', categoryId: 'spesa', subCategory1Id: 'super', count: 18 },
    { label: 'ALIMENTARI ', type: 'expense', categoryId: 'cibo', subCategory1Id: null, count: 2 },
    { label: 'Tempo libero', type: 'expense', categoryId: 'svago', subCategory1Id: null, count: 3 },
    { label: 'Tempo libero', type: 'expense', categoryId: 'viaggi', subCategory1Id: null, count: 3 },
    { label: 'Salute', type: 'expense', categoryId: 'salute', subCategory1Id: null, count: 2 },
  ]);
  assert.deepEqual(lookupBankCategory(map, 'alimentari', 'expense'), { categoryId: 'spesa', subCategory1Id: 'super', support: 18, agreement: 0.9 });
  assert.equal(lookupBankCategory(map, 'Alimentari', 'income'), null);
  assert.equal(lookupBankCategory(map, 'Tempo libero', 'expense'), null);
  assert.equal(lookupBankCategory(map, 'Salute', 'expense'), null);
  assert.equal(lookupBankCategory(map, '', 'expense'), null);
});
