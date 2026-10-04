const CACHE_NAME = 'vertice-shell-v3';
const APP_SHELL = [
  '/', '/inspecoes', '/inspecoes/nova', '/offline', '/sobre',
  '/styles.css?v=0.1.2', '/app.js?v=0.1.2', '/offline-queue.js?v=0.1.2',
  '/manifest.webmanifest', '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('vertice-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) await caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())).catch(() => {});
          return response;
        })
        .catch(async () => (await caches.match(event.request)) ||
          (url.pathname === '/inspecoes/nova' ? await caches.match('/inspecoes/nova') : undefined) || caches.match('/offline')),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then(async (response) => {
      if (response.ok) await caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone())).catch(() => {});
      return response;
    })),
  );
});
