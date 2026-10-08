import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import AuditLog from '../lib/models/AuditLog.js';

/** Tutti i file .js sotto una cartella. */
function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith('.js') ? [path] : [];
  });
}

test('ogni azione e risorsa scritta nell\'audit log è ammessa dal modello', () => {
  // writeAudit non lancia eccezioni per scelta: un valore fuori dall'enum non dà errore, la voce
  // viene solo scartata. Così la categorizzazione in blocco (BULK_UPDATE) spariva dal registro.
  const files = [...sources('app'), ...sources('lib')];
  const used = (key) => new Set(files.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(new RegExp(`${key}: '([A-Za-z_]+)'`, 'g'))].map((m) => m[1])));

  const actions = AuditLog.schema.path('action').enumValues;
  const resources = AuditLog.schema.path('resource').enumValues;
  // Le azioni sono in maiuscolo: il filtro esclude gli action: 'complete' delle API degli obiettivi.
  assert.deepEqual([...used('action')].filter((a) => a === a.toUpperCase() && !actions.includes(a)), []);
  assert.deepEqual([...used('resource')].filter((r) => !resources.includes(r)), []);
});
