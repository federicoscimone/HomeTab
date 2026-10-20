/**
 * @fileoverview Validazione delle impostazioni IA inviate dalla pagina Impostazioni → IA.
 * @module lib/ai/settingsInput
 */

import { EFFORTS, sealKey } from './settings.js';
import { parseModelSpec, providerOf } from './providers.js';

/** Oltre questo tetto è quasi certamente un errore di battitura (300 invece di 3,00). */
export const MAX_BUDGET_USD = 100;

/** Caratteri stampabili senza spazi: le chiavi API sono fatte così. */
const API_KEY_RE = /^[\x21-\x7e]{20,300}$/;

/**
 * @param {unknown} body
 * @returns {{ error: string } | { set: object, unset: object, changes: string[] }}
 *   `changes`: i campi toccati, per l'audit log. Mai il valore della chiave.
 *   Un campo a null torna al ripiego (variabile d'ambiente o predefinito).
 */
export function aiSettingsInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalidSettings' };
  const set = {};
  const unset = {};
  const changes = [];

  if ('importModel' in body) {
    const v = body.importModel;
    if (v === null) unset.importModel = '';
    else if (v === 'none') set.importModel = 'none';
    else {
      const parsed = typeof v === 'string' ? parseModelSpec(v) : null;
      const provider = providerOf(parsed);
      if (!provider || !provider.knows(parsed.name)) return { error: 'invalidModel' };
      set.importModel = parsed.spec;
    }
    changes.push('importModel');
  }

  if ('importEffort' in body) {
    const v = body.importEffort;
    if (v === null) unset.importEffort = '';
    else if (EFFORTS.includes(v)) set.importEffort = v;
    else return { error: 'invalidEffort' };
    changes.push('importEffort');
  }

  if ('monthlyBudgetUsd' in body) {
    const v = body.monthlyBudgetUsd;
    if (v === null) unset.monthlyBudgetUsd = '';
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0.01 && v <= MAX_BUDGET_USD) {
      set.monthlyBudgetUsd = Math.round(v * 100) / 100;
    } else return { error: 'invalidBudget' };
    changes.push('monthlyBudgetUsd');
  }

  if ('importAutoSuggest' in body) {
    const v = body.importAutoSuggest;
    if (v === null) unset.importAutoSuggest = '';
    else if (typeof v === 'boolean') set.importAutoSuggest = v;
    else return { error: 'invalidSettings' };
    changes.push('importAutoSuggest');
  }

  if ('anthropicApiKey' in body) {
    const v = body.anthropicApiKey;
    if (v === null) unset['providers.anthropic'] = '';
    else if (typeof v === 'string' && API_KEY_RE.test(v.trim())) set['providers.anthropic'] = sealKey(v.trim());
    else return { error: 'invalidApiKey' };
    changes.push(v === null ? 'anthropicApiKey:removed' : 'anthropicApiKey:replaced');
  }

  if (changes.length === 0) return { error: 'invalidSettings' };
  return { set, unset, changes };
}
