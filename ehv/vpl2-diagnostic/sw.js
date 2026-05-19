const CACHE = 'diag-expert-v1';
const SHELL = [
  '/ehv/vpl2-diagnostic/',
  '/ehv/vpl2-diagnostic/index.html',
  '/ehv/vpl2-diagnostic/app.js',
  '/ehv/vpl2-diagnostic/style.css',
  '/ehv/vpl2-diagnostic/manifest.json',
  '/ehv/vpl2-diagnostic/icons/icon-192.svg',
  '/ehv/vpl2-diagnostic/icons/icon-512.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Network-only: API calls
  if (url.hostname.endsWith('bunny.run')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Network-only: Google Fonts
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }
  // Cache-first: shell assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
