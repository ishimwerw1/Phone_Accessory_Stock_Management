const CACHE_VERSION = 'nsenga-legacy-electronic-v1';
const STATIC_CACHE = `${CACHE_VERSION}::static`;
const RUNTIME_CACHE = `${CACHE_VERSION}::runtime`;
const IMAGE_CACHE = `${CACHE_VERSION}::images`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/company-logo.png',
  '/logo.svg',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'CHECK_UPDATES') self.registration.update();
});

const isImageRequest = (req) =>
  req.method === 'GET' && /image\/(png|jpeg|jpg|svg|gif|webp|ico)/i.test(req.headers.get('accept') || '');

const isNavigationRequest = (req) => req.mode === 'navigate';

const isApiRequest = (url) => url.pathname.startsWith('/api/');

const fromNetwork = (request, cacheName) =>
  fetch(request).then((response) => {
    if (response && response.ok && cacheName) {
      const clone = response.clone();
      caches.open(cacheName).then((c) => c.put(request, clone)).catch(() => {});
    }
    return response;
  });

const fromCacheOr = async (request, fallback) => {
  const match = await caches.match(request);
  if (match) return match;
  return fallback;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== location.origin && !isImageRequest(request)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      fromNetwork(request, RUNTIME_CACHE).catch(async () => {
        const cached = await caches.match(request);
        return cached || (await caches.match('/index.html')) || (await caches.match('/offline.html'));
      })
    );
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      fromNetwork(request, RUNTIME_CACHE).catch(() => caches.match(request))
    );
    return;
  }

  if (isImageRequest(request)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fromNetwork(request, IMAGE_CACHE).catch(() => cached)
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fromNetwork(request, RUNTIME_CACHE).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-assets') {
    event.waitUntil(
      fetch('/index.html', { cache: 'no-store' })
        .then((r) => {
          if (r.ok) return caches.open(STATIC_CACHE).then((c) => c.put('/', r.clone()));
        })
        .catch(() => {})
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag.startsWith('replay:')) {
    event.waitUntil(Promise.resolve());
  }
});
