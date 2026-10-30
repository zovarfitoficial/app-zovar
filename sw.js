/* Service Worker - Protocolo Zovar 15X (Zovar Fit)
 * - Guarda o app no aparelho para funcionar offline.
 * - Instalação tolerante: se algum arquivo da lista não existir, o service worker ainda instala.
 * - Para publicar uma nova versão do app, aumente CACHE_VERSION (v1 -> v2).
 */
const CACHE_VERSION = 'v3';
const SHELL_CACHE = 'zovar15x-shell-' + CACHE_VERSION;
const FONT_CACHE = 'zovar15x-fonts-' + CACHE_VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('zovar15x-') && k !== SHELL_CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: guarda para uso offline
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  // Só trata arquivos do próprio site
  if (url.origin !== self.location.origin) return;

  // Abrir o app: rede primeiro, cache como reserva offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }).then((r) => r || caches.match('./', { ignoreSearch: true })))
    );
    return;
  }

  // Demais arquivos: cache primeiro, atualiza em segundo plano
  event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}
