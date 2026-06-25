// Mi Tienda PRO — Service Worker
// Versión del caché — cambia este número para forzar actualización
const CACHE_VERSION = 'tienda-pro-v1';
const CACHE_NAME = CACHE_VERSION;

// Archivos a cachear en la instalación
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  // CDN externas — se cachean en el primer uso
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap'
];

// ── INSTALL: cachear assets principales ──────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cachear assets locales (críticos)
      return cache.addAll(['./index.html', './manifest.json', './icons/icon-192.svg', './icons/icon-512.svg'])
        .then(() => {
          // Cachear CDN sin fallar si hay error de red
          return Promise.allSettled(
            ['https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
             'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js'].map(url =>
              fetch(url).then(r => cache.put(url, r)).catch(() => {})
            )
          );
        });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar cachés viejos ─────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activando:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia Cache First para assets, Network First para navegación ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar peticiones no GET
  if (event.request.method !== 'GET') return;

  // Ignorar extensiones de Chrome y peticiones de analytics
  if (url.protocol === 'chrome-extension:') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Tenemos caché — devolver inmediatamente y actualizar en background
        const fetchUpdate = fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => {});
        return cached;
      }
      // No hay caché — ir a red
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        // Cachear respuesta exitosa
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Sin red y sin caché — página de offline
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── MENSAJE: forzar actualización desde la app ───────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
