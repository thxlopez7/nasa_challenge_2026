const CACHE_NAME = 'exovitals-offline-v1';

const PRECACHE_ASSETS = [
  '/',
  '/panel',
  '/cuerpo',
  '/demo',
  '/test',
  '/manifest.json',
  '/icon.svg',
  '/data/scenario_ridge_critical.json',
  '/models/body.glb',
  '/models/body-wireframe.glb',
  '/models/heart.glb',
  '/models/lungs.glb',
  '/models/lymphatic.glb',
  '/models/spine.glb',
  '/models/eye-blue.glb',
  '/models/eye-brown.glb',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) => cache.add(asset))
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const isHeavyStatic =
    url.pathname.startsWith('/models/') ||
    url.pathname.startsWith('/data/') ||
    url.pathname.startsWith('/_next/static/');

  if (isHeavyStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached ?? networkFetch;
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const exact = await caches.match(request);
          if (exact) return exact;
          const panel = await caches.match('/panel');
          return panel ?? Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request))
  );
});
