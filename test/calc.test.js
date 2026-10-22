import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, KnownNumbers, numbersInText, numbersInToolResult } from '../lib/ai/agent/calc.js';

test('numeri nel testo: formato italiano e inglese, migliaia e decimali', () => {
  assert.deepEqual(numbersInText('Stipendio: 35.860,00 €, uscite 30.161,96 € (655 movimenti), sopra i 2.000 €', 'it'), [35860, 30161.96, 655, 2000]);
  assert.deepEqual(numbersInText('salary €35,860.00 and 2000', 'en'), [35860, 2000]);
  assert.deepEqual(numbersInText('risparmio di -2.303,06 €', 'it'), [2303.06]);
});

test('numeri nei risultati: ogni valore numerico del JSON, a ogni livello', () => {
  const r = JSON.stringify({ uscite: { valore: 30161.96, testo: '30.161,96 €' }, categorie: [{ uscite: { valore: 7500 } }], movimenti: 655 });
  assert.deepEqual(numbersInToolResult(r).sort((a, b) => a - b), [655, 7500, 30161.96]);
  assert.deepEqual(numbersInToolResult('non è JSON'), []);
});

test('calcolatrice: solo numeri già comparsi; il calcolo lo fa il codice, al centesimo', () => {
  const known = new KnownNumbers();
  known.add([35860, 30161.96, -2303.06]);
  assert.deepEqual(calculate([
    { etichetta: 'Stipendio', valore: 35860, segno: '+' },
    { etichetta: 'Uscite', valore: 30161.96, segno: '-' },
  ], known), { total: 5698.04, average: null });
  // Un risparmio negativo resta negativo; la media divide il totale.
  assert.deepEqual(calculate([{ etichetta: 'Risparmio 2025', valore: -2303.06, segno: '+' }], known, 12), { total: -2303.06, average: -191.92 });
  // Un numero mai visto non passa, anche se vicino.
  assert.deepEqual(calculate([{ etichetta: 'Stipendio', valore: 35870, segno: '+' }], known), { unknown: [35870] });
  // La tolleranza è di un centesimo, per gli importi arrotondati nei testi.
  assert.equal(calculate([{ etichetta: 'x', valore: 30161.961, segno: '+' }], known).total, 30161.96);
});
