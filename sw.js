// Service worker: po prvom načítaní uloží celú appku do cache → funguje offline.
// Pri každom nasadení novej verzie zvýš VERSION, aby sa iPad aktualizoval.

const VERSION = 'megmed-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/dates.js',
  './js/plan.js',
  './js/store.js',
  './js/util.js',
  './js/ui/sheet.js',
  './js/ui/gestures.js',
  './js/views/forms.js',
  './js/views/today.js',
  './js/views/subjects.js',
  './js/views/subject.js',
  './js/views/deadlines.js',
  './js/views/progress.js',
  './js/views/settings.js',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req, { ignoreSearch: true })
        .then((r) => r || fetch(req))
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
