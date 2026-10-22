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

test('impostazioni: il database vince sull\'ambiente, che vince sul predefinito', async () => {
  const { resolveAiSettings } = await import('../lib/ai/settings.js');
  const saved = { ...process.env };
  try {
    delete process.env.AI_MODEL_IMPORT;
    delete process.env.AI_MONTHLY_BUDGET_USD;
    let r = resolveAiSettings({});
    assert.deepEqual(r.importModel, { value: 'anthropic:claude-haiku-5-5', source: 'default' });
    assert.deepEqual(r.monthlyBudgetUsd, { value: 3, source: 'default' });

    process.env.AI_MODEL_IMPORT = 'anthropic:claude-sonnet-5-5';
    process.env.AI_MONTHLY_BUDGET_USD = 'abc';
    r = resolveAiSettings({});
    assert.deepEqual(r.importModel, { value: 'anthropic:claude-sonnet-5-5', source: 'env' });
    // Un tetto non valido vale zero, cioè IA spenta: mai "senza limite".
    assert.deepEqual(r.monthlyBudgetUsd, { value: 0, source: 'env' });

    r = resolveAiSettings({ importModel: 'none', monthlyBudgetUsd: 1.5, importEffort: 'high' });
    assert.deepEqual(r.importModel, { value: 'none', source: 'db' });
    assert.deepEqual(r.monthlyBudgetUsd, { value: 1.5, source: 'db' });
    assert.deepEqual(r.importEffort, { value: 'high', source: 'db' });
  } finally {
    process.env = saved;
  }
});

test('chiave API: cifrata sul database, decifrata solo per la chiamata, ripiego sull\'ambiente', async () => {
  const { providerKey, sealKey } = await import('../lib/ai/settings.js');
  const saved = { ...process.env };
  try {
    process.env.NEXTAUTH_SECRET = 'segreto-di-prova-segreto-di-prova';
    delete process.env.GOOGLE_DRIVE_TOKEN_SECRET;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-dallambiente-0000';
    const sealed = sealKey('sk-ant-dal-database-x7Qa');
    assert.ok(!sealed.apiKeyEnc.includes('sk-ant'), 'la chiave non deve comparire in chiaro');
    assert.equal(sealed.hint, 'x7Qa');

    const doc = { providers: { anthropic: sealed } };
    assert.deepEqual(providerKey('anthropic', doc), { apiKey: 'sk-ant-dal-database-x7Qa', source: 'db', hint: 'x7Qa', unreadable: false });
    assert.equal(providerKey('anthropic', {}).source, 'env');

    // Cambiato il segreto del server, la chiave salvata non si legge più: si segnala e si ripiega.
    process.env.NEXTAUTH_SECRET = 'un-altro-segreto-un-altro-segreto';
    assert.deepEqual(providerKey('anthropic', doc), { apiKey: 'sk-ant-dallambiente-0000', source: 'env', hint: '0000', unreadable: true });
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(providerKey('anthropic', doc).apiKey, null);
  } finally {
    process.env = saved;
  }
});

test('input delle impostazioni: solo modelli con prezzo, tetto entro i limiti, chiave mai nell\'elenco dei cambi', async () => {
  const { aiSettingsInput } = await import('../lib/ai/settingsInput.js');
  const saved = { ...process.env };
  process.env.NEXTAUTH_SECRET = 'segreto-di-prova-segreto-di-prova';
  try {
    assert.equal(aiSettingsInput(null).error, 'invalidSettings');
    assert.equal(aiSettingsInput({}).error, 'invalidSettings');
    assert.equal(aiSettingsInput({ importModel: 'anthropic:modello-inventato' }).error, 'invalidModel');
    assert.equal(aiSettingsInput({ importModel: 'openai:gpt-9' }).error, 'invalidModel');
    assert.equal(aiSettingsInput({ importEffort: 'max' }).error, 'invalidEffort');
    assert.equal(aiSettingsInput({ monthlyBudgetUsd: 300 }).error, 'invalidBudget');
    assert.equal(aiSettingsInput({ monthlyBudgetUsd: '3' }).error, 'invalidBudget');
    assert.equal(aiSettingsInput({ apiKey: { provider: 'anthropic', key: 'corta' } }).error, 'invalidApiKey');
    assert.equal(aiSettingsInput({ apiKey: { provider: 'anthropic', key: 'sk-ant con spazi dentro la chiave' } }).error, 'invalidApiKey');
    // Ollama non ha chiave, e un fornitore inventato nemmeno.
    assert.equal(aiSettingsInput({ apiKey: { provider: 'ollama', key: 'sk-qualcosa-di-abbastanza-lungo' } }).error, 'invalidApiKey');
    assert.equal(aiSettingsInput({ apiKey: { provider: 'toString', key: 'sk-qualcosa-di-abbastanza-lungo' } }).error, 'invalidApiKey');

    const ok = aiSettingsInput({ importModel: 'anthropic:claude-sonnet-5-5', monthlyBudgetUsd: 2.555, apiKey: { provider: 'anthropic', key: ' sk-ant-api03-abcdefghijklmnop ' } });
    assert.equal(ok.set.importModel, 'anthropic:claude-sonnet-5-5');
    assert.equal(ok.set.monthlyBudgetUsd, 2.56);
    assert.equal(ok.set['providers.anthropic'].hint, 'mnop');
    assert.deepEqual(ok.changes, ['importModel', 'monthlyBudgetUsd', 'apiKey:anthropic:replaced']);
    assert.ok(!JSON.stringify(ok.changes).includes('sk-ant'));

    const openai = aiSettingsInput({ apiKey: { provider: 'openai', key: 'sk-proj-abcdefghijklmnopqrstu' } });
    assert.equal(openai.set['providers.openai'].hint, 'rstu');

    const reset = aiSettingsInput({ importModel: null, apiKey: { provider: 'anthropic', key: null } });
    assert.deepEqual(reset.unset, { importModel: '', 'providers.anthropic': '' });
    assert.equal(aiSettingsInput({ importModel: 'none' }).set.importModel, 'none');
  } finally {
    process.env = saved;
  }
});

test('fornitori: modelli della tabella, aggiunti a mano e locali; indirizzo di Ollama', async () => {
  const { aiSettingsInput } = await import('../lib/ai/settingsInput.js');
  // Tabella: ogni modello con il suo fornitore, non con un altro.
  assert.equal(aiSettingsInput({ chatModel: 'openai:gpt-6-luna' }).set.chatModel, 'openai:gpt-6-luna');
  assert.equal(aiSettingsInput({ chatModel: 'google:gemini-3.8-flash' }).set.chatModel, 'google:gemini-3.8-flash');
  assert.equal(aiSettingsInput({ chatModel: 'mistral:mistral-small-2603' }).set.chatModel, 'mistral:mistral-small-2603');
  assert.equal(aiSettingsInput({ chatModel: 'openai:claude-haiku-5-5' }).error, 'invalidModel');
  assert.equal(aiSettingsInput({ chatModel: 'openai:constructor' }).error, 'invalidModel');

  // Locali: qualsiasi nome ben formato, senza prezzo.
  assert.equal(aiSettingsInput({ chatModel: 'ollama:qwen3:8b' }).set.chatModel, 'ollama:qwen3:8b');
  assert.equal(aiSettingsInput({ chatModel: 'ollama:utente/modello:q4_K_M' }).set.chatModel, 'ollama:utente/modello:q4_K_M');
  assert.equal(aiSettingsInput({ chatModel: 'ollama:con spazi' }).error, 'invalidModel');

  // Aggiunto a mano e scelto nella stessa richiesta; poi tolto, e non si può più scegliere.
  const added = aiSettingsInput({
    addCustomModel: { provider: 'mistral', name: ' mistral-medium-2604 ', input: 1.5, output: 7.5 },
    importModel: 'mistral:mistral-medium-2604',
  });
  assert.deepEqual(added.set.customModels, [{ spec: 'mistral:mistral-medium-2604', input: 1.5, output: 7.5, cacheRead: null }]);
  assert.equal(added.set.importModel, 'mistral:mistral-medium-2604');
  assert.deepEqual(added.changes, ['customModel:added', 'importModel']);
  const doc = { customModels: added.set.customModels };
  assert.equal(aiSettingsInput({ chatModel: 'mistral:mistral-medium-2604' }, doc).set.chatModel, 'mistral:mistral-medium-2604');
  const removed = aiSettingsInput({ removeCustomModel: 'mistral:mistral-medium-2604', chatModel: 'mistral:mistral-medium-2604' }, doc);
  assert.equal(removed.error, 'invalidModel');
  // Prezzi assurdi, fornitori locali o inventati, nomi strani: rifiutati.
  for (const bad of [
    { provider: 'openai', name: 'gpt-x', input: -1, output: 1 },
    { provider: 'openai', name: 'gpt-x', input: 1, output: 5000 },
    { provider: 'openai', name: 'gpt-x', input: '1', output: 1 },
    { provider: 'ollama', name: 'qwen3', input: 0, output: 0 },
    { provider: 'openai', name: 'gpt x', input: 1, output: 1 },
  ]) assert.equal(aiSettingsInput({ addCustomModel: bad }).error, 'invalidCustomModel');

  // Indirizzo di Ollama: ridotto all'origine, solo http(s), senza credenziali.
  assert.equal(aiSettingsInput({ ollamaBaseUrl: 'http://192.168.1.20:11434/api/' }).set.ollamaBaseUrl, 'http://192.168.1.20:11434');
  assert.deepEqual(aiSettingsInput({ ollamaBaseUrl: '' }).unset, { ollamaBaseUrl: '' });
  for (const bad of ['ftp://host:11434', 'http://u:p@host:11434', 'non un indirizzo', 42]) {
    assert.equal(aiSettingsInput({ ollamaBaseUrl: bad }).error, 'invalidOllamaUrl');
  }
});

test('prezzi: rincari annunciati dal loro giorno, prezzi scritti a mano prima della tabella', async () => {
  const { currentRates, costMicroUsd } = await import('../lib/ai/pricing.js');
  const { priceFor } = await import('../lib/ai/settings.js');
  const before = new Date('2026-11-30T12:00:00Z');
  const after = new Date('2026-12-01T00:00:00Z');
  assert.equal(currentRates('gemini-4-argon', before).input, 2);
  assert.equal(currentRates('gemini-4-argon', after).input, 4);
  assert.equal(costMicroUsd('gemini-4-argon', { input_tokens: 1000, output_tokens: 100 }, after), 4_000 + 2_000);

  const parsed = { spec: 'openai:gpt-6-luna', provider: 'openai', name: 'gpt-6-luna' };
  assert.equal(priceFor(parsed, {}).input, 0.10);
  // Un prezzo scritto dall'utente corregge quello della tabella.
  const fixed = priceFor(parsed, { customModels: [{ spec: 'openai:gpt-6-luna', input: 0.2, output: 1, cacheRead: null }] });
  assert.equal(fixed.input, 0.2);
  assert.equal(fixed.effort, false);
  assert.equal(costMicroUsd(fixed, { input_tokens: 1000, output_tokens: 1000 }), 200 + 1000);
  assert.equal(priceFor({ spec: 'google:gpt-6-luna', provider: 'google', name: 'gpt-6-luna' }, {}), null);
});

test('disponibilità: i modelli locali non chiedono chiave né tetto, gli altri sì', async () => {
  const { aiAvailability } = await import('../lib/ai/index.js');
  const saved = { ...process.env };
  try {
    delete process.env.DEMO_MODE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    const local = aiAvailability('chat', { chatModel: 'ollama:qwen3:8b', monthlyBudgetUsd: 0 });
    assert.equal(local.available, true);
    assert.equal(local.baseUrl, 'http://127.0.0.1:11434');
    assert.equal(local.price, null);
    assert.equal(aiAvailability('chat', { chatModel: 'ollama:qwen3:8b', ollamaBaseUrl: 'http://10.0.0.5:11434' }).baseUrl, 'http://10.0.0.5:11434');

    assert.equal(aiAvailability('chat', { chatModel: 'openai:gpt-6-luna' }).reason, 'notConfigured');
    process.env.OPENAI_API_KEY = 'sk-di-prova-abbastanza-lunga';
    const cloud = aiAvailability('chat', { chatModel: 'openai:gpt-6-luna' });
    assert.equal(cloud.available, true);
    assert.equal(cloud.price.provider, 'openai');
    assert.equal(aiAvailability('chat', { chatModel: 'openai:gpt-6-luna', monthlyBudgetUsd: 0 }).reason, 'noBudget');
    assert.equal(aiAvailability('chat', { chatModel: 'openai:gpt-9' }).reason, 'unknownModel');
    // La ricerca web è uno strumento di Anthropic.
    assert.equal(aiAvailability('importWebSearch', { importModel: 'openai:gpt-6-luna', importWebSearch: true }).reason, 'noWebSearch');
  } finally {
    process.env = saved;
  }
});

test('movimenti tra persone: la controparte non parte mai, le attività sì', async () => {
  const { maskRow } = await import('../lib/ai/mask.js');
  const sent = (row) => { const m = maskRow(row); return [m.description, m.payee].filter(Boolean).join(' | '); };
  // Nome nella colonna dell'esercente, senza diciture davanti.
  assert.equal(sent({ description: 'BONIFICO SEPA', payee: 'GIUSEPPE VERDI' }), 'BONIFICO SEPA | [NOME]');
  assert.equal(sent({ description: 'SATISPAY', payee: 'GIULIA ROSSI' }), 'SATISPAY | [NOME]');
  // Nome nella causale, subito dopo la dicitura del trasferimento.
  assert.equal(sent({ description: 'SATISPAY GIULIA ROSSI' }), 'SATISPAY [NOME]');
  assert.equal(sent({ description: 'RICARICA POSTEPAY A MARIO ROSSI' }), 'RICARICA POSTEPAY A [NOME]');
  assert.equal(sent({ description: 'PAYPAL *MARIOROSSI' }), 'PAYPAL *[NOME]');
  // La causale vera resta: è ciò che serve per categorizzare.
  assert.equal(sent({ description: 'BONIFICO A FAVORE DI GIUSEPPE MARIA VERDI AFFITTO OTTOBRE' }), 'BONIFICO A FAVORE DI [NOME] AFFITTO OTTOBRE');
  assert.equal(sent({ description: 'BONIFICO IN ENTRATA RIMBORSO SPESE MEDICHE' }), 'BONIFICO IN ENTRATA RIMBORSO SPESE MEDICHE');
  // Un'attività resta, anche pagata con Satispay o con bonifico; il professionista perde il cognome.
  assert.equal(sent({ description: 'PAGAMENTO SATISPAY', payee: 'PASTICCERIA MARCHESI' }), 'PAGAMENTO SATISPAY | PASTICCERIA MARCHESI');
  assert.equal(sent({ description: 'BONIFICO A FAVORE DI STUDIO DENTISTICO DR BIANCHI' }), 'BONIFICO A FAVORE DI STUDIO DENTISTICO DR [NOME]');
  // Un conto proprio non è una persona.
  assert.equal(sent({ description: 'GIROCONTO', payee: 'CONTO DEPOSITO' }), 'GIROCONTO | CONTO DEPOSITO');
  // Un pagamento con carta non è un trasferimento: l'esercente resta.
  assert.equal(maskRow({ description: 'PAGAMENTO POS', payee: 'DECATHLON SAN DONATO' }).transfer, false);
  assert.equal(sent({ description: 'PAGAMENTO POS', payee: 'DECATHLON SAN DONATO' }), 'PAGAMENTO POS | DECATHLON SAN DONATO');
});

test('mascheramento: ultime cifre e cognomi dopo un titolo', async () => {
  const { maskText } = await import('../lib/ai/mask.js');
  assert.equal(maskText('CARTA *1234 AMAZON'), 'CARTA *[NUM] AMAZON');
  assert.equal(maskText('GIROCONTO DA CC 4521'), 'GIROCONTO DA CC [NUM]');
  assert.equal(maskText('PRATICA N. 12345'), 'PRATICA N. [NUM]');
  assert.equal(maskText('VETERINARIO DR ROSSI CLINICA'), 'VETERINARIO DR [NOME] CLINICA');
  assert.equal(maskText('AVV. MARIA BIANCHI PARCELLA'), 'AVV. [NOME] PARCELLA');
  // Le date e gli orari non sono identificativi: restano.
  assert.equal(maskText('PAGAMENTO POS 22/10 ORE 18.32 FARMACIA'), 'PAGAMENTO POS 22/10 ORE 18.32 FARMACIA');
});

test('ricerca web: strumento giusto per modello e costo tipico per riga', async () => {
  const { webSearchTool, typicalWebRowMicro, WEB_SEARCH_MICRO } = await import('../lib/ai/pricing.js');
  // Su Haiku 5.5 la versione con filtro dinamico addebita le ricerche senza mostrarne i risultati.
  assert.equal(webSearchTool('claude-haiku-5-5'), 'web_search_20250305');
  assert.equal(webSearchTool('claude-sonnet-5-5'), 'web_search_20260209');
  assert.equal(webSearchTool('modello-inventato'), null);
  // Misurati: circa 1,1 centesimi con Haiku 5.5 e 3 con Sonnet 5.5.
  assert.equal(typicalWebRowMicro('claude-haiku-5-5'), WEB_SEARCH_MICRO + 1_000 + 150);
  assert.equal(typicalWebRowMicro('claude-sonnet-5-5'), WEB_SEARCH_MICRO + 20_000 + 3_000);
});
