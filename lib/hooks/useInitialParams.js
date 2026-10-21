'use client';

/**
 * @fileoverview Valori iniziali di una pagina letti dall'URL, con ripiego sul predefinito.
 * @module lib/hooks/useInitialParams
 *
 * Servono ai link «verifica» della chat: aprono il report con gli stessi filtri del numero
 * citato. Solo il valore iniziale viene dall'URL; poi la pagina si comporta come sempre.
 */

import { useSearchParams } from 'next/navigation';

/**
 * @param {Object<string, { fallback: any, parse?: (raw: string) => any, valid?: (v: any) => boolean }>} spec
 * @returns {Object<string, any>}
 */
export function useInitialParams(spec) {
  const sp = useSearchParams();
  const out = {};
  for (const [key, { fallback, parse = (v) => v, valid = () => true }] of Object.entries(spec)) {
    const raw = sp.get(key);
    const value = raw == null || raw === '' ? undefined : parse(raw);
    out[key] = value !== undefined && valid(value) ? value : fallback;
  }
  return out;
}

export const intIn = (min, max) => (v) => Number.isInteger(v) && v >= min && v <= max;
export const oneOf = (...values) => (v) => values.includes(v);
export const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
