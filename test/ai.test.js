import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskText } from '../lib/ai/mask.js';
import { costMicroUsd, maxCostMicroUsd, inputTokensUpperBound, PROMPT_OVERHEAD_TOKENS } from '../lib/ai/pricing.js';
import { parseModelSpec } from '../lib/ai/providers.js';

test('mascheramento: numeri di carta interi, parziali e già oscurati', () => {
  assert.equal(maskText('PAGAMENTO POS CARTA 782872 IKEA CATANIA'), 'PAGAMENTO POS CARTA [NUM] IKEA CATANIA');
  assert.equal(maskText('ACQUISTO 4532 0151 1283 0366 AMAZON'), 'ACQUISTO [CARTA] AMAZON');
  assert.equal(maskText('CARTA **** 1234 ESSELUNGA'), 'CARTA [CARTA] ESSELUNGA');
  assert.equal(maskText('CARD N. 5521 Q8 VIA ROMA'), 'CARD N. [NUM] Q8 VIA ROMA');
});

test('mascheramento: IBAN, codice fiscale, email, telefono', () => {
  assert.equal(maskText('BONIFICO SU IT60X0542811101000000123456'), 'BONIFICO SU [IBAN]');
  assert.equal(maskText('IBAN IT60 X054 2811 1010 0000 0123 456 SALDO'), 'IBAN [IBAN] SALDO');
  assert.equal(maskText('ADDEBITO RSSMRA85T10A562S'), 'ADDEBITO [CF]');
  assert.equal(maskText('RICARICA mario.rossi@example.com'), 'RICARICA [EMAIL]');
  assert.equal(maskText('RICARICA TEL 3471234567'), 'RICARICA TEL [NUM]');
});

test('mascheramento: il nome nei bonifici, ma non la causale', () => {
  assert.equal(maskText('BONIFICO A FAVORE DI MARIO ROSSI AFFITTO OTTOBRE'), 'BONIFICO A FAVORE DI [NOME] AFFITTO OTTOBRE');
  assert.equal(maskText('ORDINANTE: Anna Bianchi RIMBORSO CENA'), 'ORDINANTE: [NOME] RIMBORSO CENA');
  assert.equal(maskText('BONIFICO DA GIUSEPPE VERDI'), 'BONIFICO DA [NOME]');
});

test('mascheramento: le causali normali restano intatte', () => {
  for (const s of ['PAGAMENTO POS ESSELUNGA MILANO', 'ADDEBITO SDD ENEL ENERGIA', 'BONIFICO IN ENTRATA RIMBORSO SPESE MEDICHE', 'Q8 VIA ROMA 12']) {
    assert.equal(maskText(s), s);
  }
  assert.equal(maskText(null), '');
});

test('costo: i token per $/MTok danno micro-dollari, cache comprese', () => {
  // Haiku 5.5: 1.000 in ingresso a 0,10 + 500 in uscita a 0,50 = 100 + 250 µ$
  assert.equal(costMicroUsd('claude-haiku-5-5', { input_tokens: 1000, output_tokens: 500 }), 350);
  // Sonnet 5.5 con cache: 100×2 + 1000×2,5 + 4000×0,10 + 200×10
  assert.equal(costMicroUsd('claude-sonnet-5-5', {
    input_tokens: 100, cache_creation_input_tokens: 1000, cache_read_input_tokens: 4000, output_tokens: 200,
  }), 200 + 2500 + 400 + 2000);
  // Haiku 5.5 oltre 100.000 token di prompt: tariffe più alte su tutto.
  assert.equal(costMicroUsd('claude-haiku-5-5', { input_tokens: 100_001, output_tokens: 0 }), Math.ceil(100_001 * 0.5));
  assert.throws(() => costMicroUsd('modello-inventato', { input_tokens: 1 }));
});

test('costo massimo: tariffa più alta fra ingresso e scrittura in cache, uscita piena', () => {
  assert.equal(maxCostMicroUsd('claude-haiku-5-5', 10_000, 4_000), Math.ceil(10_000 * 0.125 + 4_000 * 0.5));
  assert.ok(maxCostMicroUsd('claude-opus-5-5', 1, 1) > maxCostMicroUsd('claude-haiku-5-5', 1, 1));
});

test('stima dell\'ingresso: byte UTF-8 più il margine, mai meno dei caratteri', () => {
  assert.equal(inputTokensUpperBound('abc', 'é'), 3 + 2 + PROMPT_OVERHEAD_TOKENS);
  assert.equal(inputTokensUpperBound(), PROMPT_OVERHEAD_TOKENS);
});

test('modello indicato come fornitore:nome', () => {
  assert.deepEqual(parseModelSpec('anthropic:claude-haiku-5-5'), { spec: 'anthropic:claude-haiku-5-5', provider: 'anthropic', name: 'claude-haiku-5-5' });
  assert.deepEqual(parseModelSpec(' ollama:llama3.1:8b '), { spec: 'ollama:llama3.1:8b', provider: 'ollama', name: 'llama3.1:8b' });
  assert.equal(parseModelSpec('claude-haiku-5-5'), null);
  assert.equal(parseModelSpec(''), null);
});
