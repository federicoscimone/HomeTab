const CACHE_NAME = 'hometab-v2';

// Static shell to pre-cache on install
const PRECACHE_URLS = [
  '/offline',
];

// ── Install: pre-cache the app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: strategy per tipo di risorsa ───────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo richieste GET stesso dominio
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigazioni HTML: network-first per evitare mismatch tra shell/chunk dopo deploy.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // API: network-first (dati sempre freschi, nessuna cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets Next.js (_next/static): cache-first (immutabili, hash nel nome)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Tutto il resto (pagine, icone, ecc.): stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── Strategie ─────────────────────────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    // Offline + nessuna cache per le API
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache   = await caches.open(CACHE_NAME);
  const cached  = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Risposta dalla cache subito; aggiorna in background
  if (cached) return cached;

  // Nessuna cache: attendi la rete o mostra offline
  const response = await fetchPromise;
  if (response) return response;

  // Fallback offline per le pagine HTML
  const offlineFallback = await cache.match('/offline');
  return offlineFallback || new Response('Offline', { status: 503 });
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offlineFallback = await cache.match('/offline');
    return offlineFallback || new Response('Offline', { status: 503 });
  }
}
