/**
 * Test della matrice ruoli/permessi e delle regole sulle pagine.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, pageRedirectFor, PERMISSIONS, ROLES } from '../lib/auth/permissions.js';

test('il lettore vede ma non modifica', () => {
  assert.equal(can('viewer', 'data:read'), true);
  for (const p of Object.keys(PERMISSIONS).filter((p) => p !== 'data:read')) {
    assert.equal(can('viewer', p), false, p);
  }
});

test('il collaboratore aggiunge e modifica movimenti, ma non elimina né amministra', () => {
  assert.equal(can('editor', 'movements:create'), true);
  assert.equal(can('editor', 'movements:edit'), true);
  assert.equal(can('editor', 'movements:delete'), false);
  assert.equal(can('editor', 'goals:manage'), false);
  assert.equal(can('editor', 'settings:manage'), false);
  assert.equal(can('editor', 'users:manage'), false);
});

test('l\'amministratore può tutto', () => {
  for (const p of Object.keys(PERMISSIONS)) assert.equal(can('admin', p), true, p);
});

test('ruolo assente o sconosciuto: nessun permesso', () => {
  assert.equal(can(undefined, 'data:read'), false);
  assert.equal(can('superuser', 'data:read'), false);
});

test('un permesso inesistente è un errore di programmazione, non un "no" silenzioso', () => {
  assert.throws(() => can('admin', 'movimenti:crea'), /Permesso sconosciuto/);
});

test('ogni permesso è assegnato solo a ruoli esistenti', () => {
  for (const [p, roles] of Object.entries(PERMISSIONS)) {
    for (const r of roles) assert.ok(ROLES.includes(r), `${p}: ${r}`);
  }
});

test('pagine riservate', () => {
  assert.equal(pageRedirectFor('/impostazioni', 'editor'), '/');
  assert.equal(pageRedirectFor('/impostazioni/utenti', 'viewer'), '/');
  assert.equal(pageRedirectFor('/impostazioni/utenti', 'admin'), null);
  assert.equal(pageRedirectFor('/importa', 'viewer'), '/movimenti');
  assert.equal(pageRedirectFor('/importa', 'editor'), null);
  assert.equal(pageRedirectFor('/movimenti/nuova', 'viewer'), '/movimenti');
  assert.equal(pageRedirectFor('/movimenti/abc123', 'viewer'), '/movimenti');
  assert.equal(pageRedirectFor('/movimenti/abc123', 'editor'), null);
  assert.equal(pageRedirectFor('/movimenti', 'viewer'), null);
  assert.equal(pageRedirectFor('/obiettivi', 'viewer'), null);
  assert.equal(pageRedirectFor('/account', 'viewer'), null);
});
