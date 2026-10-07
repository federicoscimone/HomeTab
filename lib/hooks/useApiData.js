'use client';

/**
 * @fileoverview Caricamento dei dati JSON di una rotta API, legato all'URL richiesto.
 * @module lib/hooks/useApiData
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Carica `url`, e lo ricarica quando l'URL cambia o quando si chiama `reload()`.
 *
 * Il risultato ricorda la richiesta che l'ha prodotto, e `loading` resta vero finché quella
 * mostrata non è la richiesta corrente. Prima ogni pagina impostava `loading` a mano all'inizio
 * dell'effetto: oltre a violare react-hooks/set-state-in-effect, una risposta lenta di un filtro
 * precedente poteva arrivare dopo quella giusta e sostituirla. Qui la richiesta superata viene
 * annullata, e il suo risultato non entra mai nello stato.
 *
 * Durante un nuovo caricamento `data` conserva il risultato precedente, come facevano le pagine.
 *
 * @param {string|null} url - null per non caricare nulla.
 * @param {string} [label='api'] - Prefisso dei messaggi di errore in console.
 * @returns {{ data: any, loading: boolean, error: boolean, reload: () => void }}
 *
 * @example
 * const { data, loading, error } = useApiData(`/api/report/pivot?${params}`, 'pivot');
 */
export function useApiData(url, label = 'api') {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: false });
  const key = url ? `${version}:${url}` : null;

  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setResult({ key, data, error: false }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(`[${label}] fetch error:`, err);
        setResult((prev) => ({ key, data: prev.data, error: true }));
      });
    return () => controller.abort();
  }, [key, url, label]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = key !== null && result.key === key;

  return {
    data: result.data,
    loading: key !== null && !current,
    error: current && result.error,
    reload,
  };
}
