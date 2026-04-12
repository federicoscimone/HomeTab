'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(reg => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available — could show a toast here if desired
                console.info('[HomeTab] Nuova versione disponibile. Ricarica per aggiornare.');
              }
            });
          });
        })
        .catch(err => console.warn('[HomeTab] Service worker non registrato:', err));
    }
  }, []);

  return null;
}
