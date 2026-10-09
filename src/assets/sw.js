// CuadreEnv POS - Service Worker para PWA y Resiliencia Offline
const CACHE_NAME = 'cuadreenv-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/manifest.webmanifest',
  '/favicon.ico',
  '/assets/brand/favicon-32x32.png',
  '/assets/brand/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') return;

  // Ignorar llamadas directas a APIs dinámicas (las APIs se manejan con IndexedDB en pos-offline-sync.service)
  if (event.request.url.includes('/api/') || event.request.url.includes('/v1/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => {
        // Fallback para rutas de navegación SPA en offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
