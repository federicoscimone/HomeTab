import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  htmlToText, mistralModelPages, numbersIn, relevantText, verifyExtraction, MAX_TEXT_CHARS,
} from '../lib/ai/tasks/priceUpdate.js';
import { currentRates, PRICES, refreshedPrice } from '../lib/ai/pricing.js';
import { priceFor } from '../lib/ai/settings.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≠ ${expected}`);

test('pagine: testo visibile, senza script; indice di Mistral solo con i modelli di chat attuali', () => {
  const html = '<html><script>var p = "$9.99";</script><style>.x{}</style><td>Haiku&nbsp;5.5</td><td>$0.10 &amp; $0.50</td></html>';
  assert.equal(htmlToText(html), 'Haiku 5.5 $0.10 & $0.50');
  const index = '<a href=\\"/models/mistral-large-4-0\\"> <a href=\\"/models/ocr-4-1\\"> <a href="/models/mistral-small-4-0-26-03">'
    + '<a href="/models/mistral-embed-23-12"> <a href="/models/ministral-3-8b-25-12"> <h2>Deprecated</h2> <a href="/models/mistral-medium-3-25-05">';
  assert.deepEqual(mistralModelPages(index, 'https://docs.mistral.ai'), [
    'https://docs.mistral.ai/models/mistral-large-4-0',
    'https://docs.mistral.ai/models/mistral-small-4-0-26-03',
    'https://docs.mistral.ai/models/ministral-3-8b-25-12',
  ]);
});

test('testo da mandare: intero se è corto, altrimenti i pezzi intorno ai modelli', () => {
  assert.equal(relevantText('corto Haiku 5.5 $1', ['claude-haiku-5-5']), 'corto Haiku 5.5 $1');
  const filler = 'x '.repeat(MAX_TEXT_CHARS);
  const long = `${filler} Claude Haiku 5.5 costa $0.10 ${filler} Gemini 3.8 Flash $0.75 ${filler}`;
  const cut = relevantText(long, ['claude-haiku-5-5', 'gemini-3.8-flash'], { before: 10, after: 40 });
  assert.ok(cut.includes('Claude Haiku 5.5 costa $0.10'));
  assert.ok(cut.includes('Gemini 3.8 Flash $0.75'));
  assert.ok(cut.length < 200);
  assert.equal(relevantText(long, ['gpt-6-luna']), '');
});

test('numeri: decimali col punto o la virgola, migliaia con la virgola', () => {
  assert.deepEqual(numbersIn('$0.10 / MTok up to 100,000 tokens, poi 0,15'), [0.1, 100000, 0.15]);
});

test('verifica: passa solo ciò che sta nella pagina, con quei numeri', () => {
  const page = 'gpt-6-luna $0.10 $0.50 $0.01 gpt-6.1-sol $2.00 $10.00 $0.10. Gemini 4 Argon $2.00 through November 30, 2026. $4.00 starting December 1, 2026. Output $10.00, then $20.00';
  const ids = ['gpt-6-luna', 'gpt-6.1-sol', 'gemini-4-argon', 'mistral-small-2603'];
  const none = { cacheRead: null, upcomingFrom: null, upcomingInput: null, upcomingOutput: null, upcomingCacheRead: null };
  const res = verifyExtraction({
    models: [
      { ...none, id: 'gpt-6-luna', found: true, input: 0.1, output: 0.5, cacheRead: 0.01, quote: 'gpt-6-luna  $0.10 $0.50\n$0.01' },
      // Citazione inventata: non è nella pagina.
      { ...none, id: 'gpt-6.1-sol', found: true, input: 0.2, output: 1, quote: 'gpt-6.1-sol $0.20 $1.00' },
      { ...none, id: 'gemini-4-argon', found: true, input: 2, output: 10, quote: 'Gemini 4 Argon $2.00 through November 30, 2026. $4.00 starting December 1, 2026. Output $10.00, then $20.00', upcomingFrom: '2026-12-01', upcomingInput: 4, upcomingOutput: 20 },
      // Un modello che non era stato chiesto non entra.
      { ...none, id: 'gpt-9', found: true, input: 0.1, output: 0.5, quote: 'gpt-6-luna $0.10 $0.50' },
    ],
  }, ids, page);
  assert.deepEqual(res[0], { id: 'gpt-6-luna', input: 0.1, output: 0.5, cacheRead: 0.01, quote: 'gpt-6-luna $0.10 $0.50 $0.01', upcoming: null });
  assert.equal(res[1].rejected, 'unverified');
  assert.deepEqual(res[2].upcoming, { from: '2026-12-01', input: 4, output: 20, cacheRead: null });
  assert.equal(res[3].rejected, 'notFound');
  assert.equal(res.length, 4);

  // La citazione c'è, ma il prezzo riportato no: scartato.
  const wrong = verifyExtraction({ models: [{ ...none, id: 'gpt-6-luna', found: true, input: 0.05, output: 0.5, quote: 'gpt-6-luna $0.10 $0.50' }] }, ['gpt-6-luna'], page);
  assert.equal(wrong[0].rejected, 'unverified');
  // Prezzi fuori scala: scartati anche se scritti nella citazione.
  const absurd = verifyExtraction({ models: [{ ...none, id: 'gpt-6-luna', found: true, input: 2026, output: 0.5, quote: 'November 30, 2026. $4.00' }] }, ['gpt-6-luna'], `${page} November 30, 2026. $4.00`);
  assert.equal(absurd[0].rejected, 'unverified');
});

test('prezzi letti dalla pagina: sostituiscono la tabella, con i rapporti di cache e i rincari giusti', () => {
  const haiku = refreshedPrice(PRICES['claude-haiku-5-5'], { input: 0.2, output: 1, cacheRead: null, updatedAt: '2026-11-01' });
  near(haiku.cacheWrite, 0.25);
  near(haiku.cacheRead, 0.02);
  assert.equal(haiku.effort, true);
  assert.equal(haiku.longContext.above, 100_000);

  // Senza rincari letti valgono quelli della tabella successivi all'aggiornamento.
  const argon = refreshedPrice(PRICES['gemini-4-argon'], { input: 2, output: 10, cacheRead: 0.1, updatedAt: '2026-11-01' });
  assert.equal(currentRates(argon, new Date('2026-12-05')).input, 4);
  const argonLater = refreshedPrice(PRICES['gemini-4-argon'], { input: 5, output: 25, cacheRead: 0.25, updatedAt: '2026-12-10' });
  assert.equal(currentRates(argonLater, new Date('2026-12-15')).input, 5);
  // I rincari letti dalla pagina prendono il posto di quelli della tabella.
  const argonRead = refreshedPrice(PRICES['gemini-4-argon'], { input: 2, output: 10, cacheRead: 0.1, updatedAt: '2026-11-01', changes: [{ from: '2027-02-01', input: 3, output: 15, cacheRead: null }] });
  assert.equal(currentRates(argonRead, new Date('2026-12-05')).input, 2);
  near(currentRates(argonRead, new Date('2027-02-02')).cacheRead, 0.15);

  // In priceFor: modello aggiunto a mano, poi aggiornamento dalla pagina, poi tabella.
  const parsed = { spec: 'openai:gpt-6-luna', provider: 'openai', name: 'gpt-6-luna' };
  assert.equal(priceFor(parsed, { priceOverrides: [{ spec: 'openai:gpt-6-luna', input: 0.12, output: 0.6, cacheRead: null, updatedAt: new Date() }] }).input, 0.12);
  assert.equal(priceFor(parsed, {
    customModels: [{ spec: 'openai:gpt-6-luna', input: 0.3, output: 1, cacheRead: null }],
    priceOverrides: [{ spec: 'openai:gpt-6-luna', input: 0.12, output: 0.6, cacheRead: null, updatedAt: new Date() }],
  }).input, 0.3);
});

test('modelli nuovi: dall\'elenco del fornitore solo quelli di chat, senza alias né copie con la data', async () => {
  const { chatModelsOnly } = await import('../lib/ai/providers.js');
  const { pricePrompt } = await import('../lib/ai/tasks/priceUpdate.js');
  const list = [
    { id: 'claude-haiku-4-5', created: 1 },
    { id: 'claude-haiku-4-5-20251001', created: 2 },   // copia della versione senza data
    { id: 'claude-opus-4-5-20251101', created: 3 },    // l'unica versione: resta
    { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', created: 9 },
    { id: 'text-embedding-4-large', created: 8 },
    { id: 'gpt-6-luna-realtime', created: 7 },
    { id: 'gpt-6-luna-2026-08-14', created: 6 },
    { id: 'gpt-6-luna', created: 5 },
    { id: 'mistral-medium-latest', created: 4 },
    { id: 'imagen-5', created: 4 },
  ];
  assert.deepEqual(chatModelsOnly(list).map((m) => m.id), ['claude-fable-5-1', 'gpt-6-luna', 'claude-opus-4-5-20251101', 'claude-haiku-4-5']);
  const prompt = pricePrompt('anthropic', ['claude-haiku-5-5'], [{ id: 'claude-fable-5-1', name: 'Claude Fable 5.1' }], 'testo');
  assert.ok(prompt.includes('Model ids: claude-haiku-5-5'));
  assert.ok(prompt.includes('New candidate ids: claude-fable-5-1 (Claude Fable 5.1)'));
  assert.ok(!pricePrompt('openai', ['gpt-6-luna'], [], 'testo').includes('candidate'));
});

test('modelli nuovi: solo il più recente di ogni famiglia, e solo se manca', async () => {
  const { familyOf, newModelsOnly } = await import('../lib/ai/providers.js');
  assert.equal(familyOf('claude-opus-5-5'), 'claude-opus');
  assert.equal(familyOf('gemini-3.1-pro-preview'), 'gemini-pro');
  assert.equal(familyOf('mistral-small-2603'), 'mistral-small');
  const day = (d) => Date.parse(d);
  // L'elenco vero di Anthropic del 22 ottobre 2026, in parte.
  const anthropic = [
    { id: 'claude-haiku-5-5', created: day('2026-10-07') }, { id: 'claude-sonnet-5-5', created: day('2026-09-28') },
    { id: 'claude-opus-5-5', created: day('2026-09-21') }, { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', created: day('2026-08-28') },
    { id: 'claude-opus-5', created: day('2026-07-24') }, { id: 'claude-fable-5', created: day('2026-06-07') },
    { id: 'claude-opus-4-6', created: day('2026-02-04') }, { id: 'claude-sonnet-4-5-20250929', created: day('2025-09-29') },
  ];
  const known = ['claude-haiku-5-5', 'claude-haiku-4-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
  assert.deepEqual(newModelsOnly(anthropic, known).map((m) => m.id), ['claude-fable-5-1']);
  // Senza date (Google) decide la versione; la preview conta come la stessa famiglia.
  const google = [{ id: 'gemini-2.5-pro' }, { id: 'gemini-3.1-pro-preview' }, { id: 'gemini-3.6-flash' }, { id: 'gemini-3.8-flash' }, { id: 'gemini-3.9-flash' }];
  assert.deepEqual(newModelsOnly(google, ['gemini-3.8-flash']).map((m) => m.id), ['gemini-3.9-flash', 'gemini-3.1-pro-preview']);
  assert.deepEqual(newModelsOnly([{ id: 'gemini-3.6-flash' }], ['gemini-3.8-flash']), []);
});
