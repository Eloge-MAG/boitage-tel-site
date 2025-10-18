// sw.js — cache app shell + modèles + polices (offline)
const CACHE_NAME = 'elogemag-v2025.10.17-165632'; // ← sera remplacé par le script PowerShell
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './print-env.css',
  './app.js',
  './manifest.webmanifest',
  './letter_moderne.html',
  './letter_historique.html',
  './letter_rurale.html',
  './envelope_a4.html',
  // fonts
  './fonts/NotoSans-Regular.woff2',
  './fonts/NotoSans-Bold.woff2',
  './fonts/NotoSans-Regular.ttf',
  './fonts/NotoSans-Bold.ttf',
  './fonts/Timeless.ttf',
  './fonts/Timeless-Bold.ttf',
  // icons
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// HTML = network-first ; autres = cache-first (avec mise en cache opportuniste)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  // 1) Pages HTML → network-first (évite les vieilles versions)
  if (isHTML) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: 'no-store' });
        const c = await caches.open(CACHE_NAME);
        c.put(req, net.clone()).catch(() => {});
        return net;
      } catch {
        const cached = await caches.match(req) || await caches.match('./index.html');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 2) Assets → cache-first
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const net = await fetch(req);
      if (new URL(req.url).origin === self.location.origin && net && net.ok) {
        const c = await caches.open(CACHE_NAME);
        c.put(req, net.clone()).catch(() => {});
      }
      return net;
    } catch {
      const fallback = await caches.match('./index.html');
      return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

