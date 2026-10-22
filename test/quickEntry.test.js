import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_METHOD, parseAmount, parseQuickEntry } from '../lib/utils/quickEntry.js';

const TODAY = '2026-10-22';

test('importi all\'italiana e all\'inglese', () => {
  assert.equal(parseAmount('12,50'), 12.5);
  assert.equal(parseAmount('12.5'), 12.5);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('1234'), 1234);
});

test('spesa semplice: importo e descrizione in qualsiasi ordine', () => {
  assert.deepEqual(parseQuickEntry('12,50 pizza', TODAY), {
    amount: 12.5, type: 'expense', date: TODAY, paymentMethod: DEFAULT_METHOD, description: 'pizza',
  });
  assert.equal(parseQuickEntry('pizza da Mario 18€', TODAY).description, 'pizza da Mario');
  assert.equal(parseQuickEntry('pizza da Mario 18 euro', TODAY).amount, 18);
});

test('più numeri: la valuta o i decimali, altrimenti il più grande', () => {
  assert.equal(parseQuickEntry('2 pizze 18', TODAY).amount, 18);
  assert.equal(parseQuickEntry('2 pizze 18', TODAY).description, '2 pizze');
  assert.equal(parseQuickEntry('35 € cena per 4', TODAY).amount, 35);
  assert.equal(parseQuickEntry('volo 2 biglietti 230,40', TODAY).amount, 230.4);
});

test('data e metodo di pagamento dalle parole, tolte dalla descrizione', () => {
  const e = parseQuickEntry('ieri 40 benzina contanti', TODAY);
  assert.equal(e.date, '2026-10-21');
  assert.equal(e.paymentMethod, 'cash');
  assert.equal(e.description, 'benzina');
  assert.equal(parseQuickEntry('altro ieri 9 bar', TODAY).date, '2026-10-20');
  assert.equal(parseQuickEntry('7,50 pranzo buono pasto', TODAY).paymentMethod, 'meal_ticket');
});

test('entrata con il segno più', () => {
  const e = parseQuickEntry('+1500 stipendio', TODAY);
  assert.equal(e.type, 'income');
  assert.equal(e.amount, 1500);
});

test('senza importo, o con importo zero, non è una spesa', () => {
  assert.equal(parseQuickEntry('ciao come va', TODAY), null);
  assert.equal(parseQuickEntry('0 pizza', TODAY), null);
  assert.equal(parseQuickEntry('', TODAY), null);
});
