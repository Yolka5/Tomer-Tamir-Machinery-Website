const CACHE = 'ttm-v2';

const PRECACHE = [
  '/',
  '/index.html',
  '/beaver.html',
  '/compare.html',
  '/mission.html',
  '/forge.html',
  '/styles.css',
  '/script.js',
  '/TTMNewLogo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // HTML, CSS and JS: network-first so a deploy takes effect on the next load
  // instead of serving whatever was cached the first time a visitor arrived.
  // The cache copy is still written, so offline keeps working.
  const isCode = /\.(css|js|mjs)$/.test(url.pathname);
  if (isCode || e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Images, fonts and models are immutable in practice: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }))
  );
});
