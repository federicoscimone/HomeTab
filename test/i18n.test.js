import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLocale } from '../lib/i18n/locale.js';
import { fmt, fmtAxis, fmtDate, fmtFull, fmtMonth, fmtPct, monthNames } from '../lib/utils/format.js';

const load = (locale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));

/** Ogni chiave foglia con i segnaposto {nome} e i tag <tag> che usa. */
function leaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') return leaves(value, path);
    // Un segnaposto è {nome} o {nome, plural|select…}: la parola che apre un ramo plurale
    // ("one {Salta # riga}") è testo, non una variabile.
    const tokens = [...String(value).matchAll(/\{(\w+)\s*[,}]|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`);
    return [[path, [...new Set(tokens)].sort().join(',')]];
  });
}

test('italiano e inglese hanno le stesse chiavi', () => {
  const it = new Map(leaves(load('it')));
  const en = new Map(leaves(load('en')));
  assert.deepEqual([...it.keys()].filter((k) => !en.has(k)), [], 'chiavi solo in it.json');
  assert.deepEqual([...en.keys()].filter((k) => !it.has(k)), [], 'chiavi solo in en.json');
});

test('ogni traduzione usa gli stessi segnaposto e tag', () => {
  const en = new Map(leaves(load('en')));
  for (const [key, tokens] of leaves(load('it'))) {
    assert.equal(en.get(key), tokens, `segnaposto diversi in ${key}`);
  }
});

test('nessun apostrofo apre per errore una sezione letterale ICU', () => {
  // In ICU un apostrofo seguito da { } < # | inizia un testo letterale: "scarica l'<link>…" usciva
  // grezzo, con i tag e i segnaposto in chiaro. Davanti a quei caratteri serve l'apostrofo
  // tipografico (’), che in italiano è comunque quello corretto.
  for (const locale of ['it', 'en']) {
    const messages = load(locale);
    const value = (key) => key.split('.').reduce((node, part) => node[part], messages);
    const broken = leaves(messages).map(([key]) => key).filter((key) => /'[{}<#|]/.test(value(key)));
    assert.deepEqual(broken, [], `apostrofi da sostituire in ${locale}.json`);
  }
});

test('resolveLocale: cookie, poi lingue del browser, poi italiano', () => {
  assert.equal(resolveLocale('en', 'it-IT'), 'en');
  assert.equal(resolveLocale(undefined, 'en-US,en;q=0.9,it;q=0.8'), 'en');
  assert.equal(resolveLocale(undefined, 'de-DE,it;q=0.5,en;q=0.4'), 'it');
  assert.equal(resolveLocale(undefined, 'fr-FR,en;q=0.3,it;q=0.7'), 'it');
  assert.equal(resolveLocale('xx', 'de-DE'), 'it');
  assert.equal(resolveLocale(undefined, ''), 'it');
});

test('formati di importi, percentuali e mesi nelle due lingue', () => {
  // Intl separa cifra e simbolo con uno spazio non divisibile: lo si normalizza per il confronto.
  const plain = (s) => s.replace(/ | /g, ' ');
  // Separatore delle migliaia anche a quattro cifre, contro la regola CLDR italiana (vedi format.js).
  assert.equal(plain(fmtFull(1234.5, 'it')), '1.234,50 €');
  assert.equal(plain(fmtFull(12345.5, 'it')), '12.345,50 €');
  assert.equal(fmtFull(12345.5, 'en'), '€12,345.50');
  assert.equal(fmt(0, 'en'), '—');
  assert.equal(fmtPct(12.5, 'it'), '+12,5%');
  assert.equal(fmtPct(-3.25, 'en'), '-3.3%');
  assert.equal(fmtPct(null), '—');
  assert.equal(fmtMonth('2027-08', false, 'it'), 'Ago 2027');
  assert.equal(fmtMonth('2027-08', true, 'en'), 'Aug 27');
  assert.equal(monthNames('en', 'long')[8], 'September');
  assert.equal(fmtDate('2026-10-07', 'it'), '7 ott 2026');
  assert.equal(fmtDate('2026-09-01T00:00:00Z', 'en'), '1 Sep 2026');
  assert.equal(fmtDate(null, 'en'), '—');
  assert.equal(plain(fmtAxis(1500, 'it')), '1,5k €');
  assert.equal(fmtAxis(1500, 'en'), '€1.5k');
  assert.equal(plain(fmtAxis(800, 'it')), '800 €');
  assert.equal(fmtAxis(-2000, 'en'), '-€2k');
});
