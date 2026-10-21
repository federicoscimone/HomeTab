import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareWithIstat, comparisonWindow, istatReference, sizeKey } from '../lib/utils/istat.js';
import { defaultCoicop, DIVISIONS, movementDivision } from '../lib/utils/coicop.js';
import snapshot from '../data/istat/spese-famiglie.js';

const fake = {
  values: {
    IT: {
      N3: { '01': 600, '04': 1000, '042': 600, '10': 20, ALL: 3000 },
      TOT: { '01': 500, '04': 1000, '042': 610, ALL: 2700 },
    },
    ITCD: { N3: { '01': 650, '04': 1100, '10': 30, ALL: 3200 }, TOT: { '04': 1100, '042': 640, ALL: 2900 } },
    ITC4: { N3: { '01': 700, '04': 1200, '10': null, ALL: 3500 } },
  },
};

test('classe dei componenti: 5 vuol dire 5 o più, nessuno vuol dire il totale', () => {
  assert.equal(sizeKey(3), 'N3');
  assert.equal(sizeKey(7), 'N5_GE');
  assert.equal(sizeKey(null), 'TOT');
});

test('valore della regione, e ripiego sulla ripartizione dove ISTAT non lo pubblica', () => {
  const r = istatReference(fake, { region: 'ITC4', members: 3 }, ['01', '10']);
  assert.deepEqual(r['01'], { value: 700, area: 'ITC4', estimated: false });
  assert.deepEqual(r['10'], { value: 30, area: 'ITCD', estimated: false });
});

test('casa senza affitti figurativi: esatta dove ISTAT li pubblica, stimata per regione', () => {
  const italy = istatReference(fake, { members: 3 }, ['04']);
  assert.deepEqual(italy['04'], { value: 400, area: 'IT', estimated: false });

  // Quota della ripartizione (640/1100), corretta per i componenti con il rapporto nazionale
  // (0,6 per tre componenti contro 0,61 in totale), applicata al dato della regione.
  const share = (640 / 1100) * (0.6 / 0.61);
  const region = istatReference(fake, { region: 'ITC4', members: 3 }, ['04', 'ALL']);
  assert.equal(region['04'].estimated, true);
  assert.equal(region['04'].value, Math.round((1200 - 1200 * share) * 100) / 100);
  assert.equal(region.ALL.value, Math.round((3500 - 1200 * share) * 100) / 100);
});

test('finestra: 12 mesi completi, o meno se i movimenti cominciano dopo', () => {
  assert.deepEqual(comparisonWindow(new Date(2026, 9, 21)), { from: '2025-10-01', to: '2026-09-30', months: 12 });
  assert.deepEqual(comparisonWindow(new Date(2026, 9, 21), '2026-04-15'), { from: '2026-04-01', to: '2026-09-30', months: 6 });
  assert.equal(comparisonWindow(new Date(2026, 9, 21), '2026-10-02').months, 0);
  assert.deepEqual(comparisonWindow(new Date(2026, 0, 5)), { from: '2025-01-01', to: '2025-12-31', months: 12 });
});

test('capitolo di un movimento: la sottocategoria vince, altrimenti eredita la madre', () => {
  const byId = new Map([['u', { coicop: '04' }], ['net', { coicop: '08' }], ['luce', { coicop: null }], ['regali', { coicop: null }]]);
  assert.equal(movementDivision(byId, { categoryId: 'u', subCategory1Id: 'net' }), '08');
  assert.equal(movementDivision(byId, { categoryId: 'u', subCategory1Id: 'luce' }), '04');
  assert.equal(movementDivision(byId, { categoryId: 'regali' }), null);
});

test('capitoli predefiniti per le categorie del seed', () => {
  assert.equal(defaultCoicop('Spesa'), '01');
  assert.equal(defaultCoicop('Utenze', 'Internet'), '08');
  assert.equal(defaultCoicop('Utenze', 'Luce'), null); // eredita la madre
  assert.equal(defaultCoicop('Regali'), null);
  assert.equal(defaultCoicop('Una categoria mia'), null);
});

test('somma per capitolo in media mensile; le categorie senza capitolo restano nel totale', () => {
  const byId = new Map([['spesa', { name: 'Spesa', coicop: '01' }], ['regali', { name: 'Regali', coicop: null }]]);
  const r = compareWithIstat({
    groups: [
      { _id: { c: 'spesa' }, total: 1200 },
      { _id: { c: 'regali' }, total: 240 },
      { _id: {}, total: 60 },
    ],
    byId,
    months: 12,
    reference: { '01': { value: 80, area: 'IT', estimated: false }, '02': { value: null, area: null }, ALL: { value: 150, area: 'IT', estimated: true } },
    divisions: ['01', '02'],
    divisionOf: (ids) => movementDivision(byId, { categoryId: ids.c }),
  });
  assert.deepEqual(r.rows[0], { code: '01', yours: 100, istat: 80, diff: 20, pct: 25, area: 'IT', estimated: false });
  assert.equal(r.rows[1].diff, null);
  assert.deepEqual(r.total, { yours: 125, istat: 150, diff: -25, pct: -16.67, area: 'IT', estimated: true });
  assert.deepEqual(r.unmapped, [{ name: 'Regali', monthly: 20 }]);
  assert.equal(r.uncategorized, 5);
});

test('istantanea: ogni capitolo ha un valore per la Lombardia con tre componenti, o un ripiego', () => {
  const r = istatReference(snapshot, { region: 'ITC4', members: 3 }, [...DIVISIONS, 'ALL']);
  for (const code of [...DIVISIONS, 'ALL']) assert.ok(r[code].value > 0, code);
  // La casa senza affitti figurativi resta una parte ragionevole del capitolo intero.
  const housing = snapshot.values.ITC4.N3['04'];
  assert.ok(r['04'].value > housing * 0.3 && r['04'].value < housing * 0.6, String(r['04'].value));
});

test('capitoli proposti dall\'IA: solo per chi non ne ha, e le figlie uguali alla madre ereditano', async () => {
  const { buildMappingRequest, readMapping } = await import('../lib/ai/tasks/coicopMapping.js');
  const cats = [
    { _id: 'p', name: 'Palestra e sport', level: 1, parentId: null, coicop: null },
    { _id: 'p1', name: 'Abbonamento', level: 2, parentId: 'p', coicop: null },
    { _id: 'p2', name: 'Fisioterapia', level: 2, parentId: 'p', coicop: null },
    { _id: 's', name: 'Spesa', level: 1, parentId: null, coicop: '01' },
  ];
  const { codes, toAssign, prompt } = buildMappingRequest(cats);
  assert.equal(toAssign, 3);
  assert.ok(prompt.includes('"assign": true'));
  const proposals = readMapping({
    assignments: [
      { code: 'c1.1', division: '09' }, // come la madre: eredita
      { code: 'c1.2', division: '06' },
      { code: 'c1', division: '09' },
      { code: 'c2', division: '11' }, // già assegnata a mano: non si tocca
      { code: 'c9', division: '01' }, // inesistente
    ],
  }, codes);
  assert.deepEqual(proposals, { p: '09', p2: '06' });
});
