#!/usr/bin/env node
/**
 * Crea .env da .env.example sostituendo ogni "change-me" con un segreto casuale.
 *
 * Esiste perché il primo avvio non dipenda dalla fantasia di chi clona: password di Mongo e
 * segreto delle sessioni lasciati a "change-me" funzionerebbero comunque, e sarebbero gli stessi
 * per tutti. Non sovrascrive mai un .env esistente: lì potrebbero esserci credenziali reali.
 *
 * Uso: npm run setup
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, '.env.example');
const target = path.join(root, '.env');

if (existsSync(target)) {
  console.error('.env esiste già: non lo sovrascrivo. Cancellalo a mano se vuoi rigenerarlo.');
  process.exit(1);
}

let count = 0;
const content = readFileSync(example, 'utf8').replace(/^([A-Z0-9_]+)=change-me$/gm, (_, name) => {
  count += 1;
  return `${name}=${randomBytes(32).toString('hex')}`;
});

// 0600: il file contiene password, solo il proprietario deve poterlo leggere.
writeFileSync(target, content, { mode: 0o600 });
console.log(`.env creato con ${count} segreti casuali. Avvio: docker compose up -d`);
