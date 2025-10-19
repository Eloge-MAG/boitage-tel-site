// sw.js — PWA cache (robuste) pour boitage-tel
// ------------------------------------------------------------
// Points clés :
// - Respecte les query strings (?v=...)
// - HTML : stratégie "network-first" (on essaye le réseau d'abord)
// - Assets (CSS/JS/polices/images) : "cache-first" + revalidation
// - skipWaiting/clients.claim pour activer immédiatement la nouvelle version
// - Nettoyage des anciens caches

// ⚠️ Mets une étiquette de version simple ici (tu peux la laisser telle quelle ;
//    si tu changes cette valeur à chaque déploiement important, c’est encore mieux).
const SW_VERSION = '2025.10.19-01';

const CACHE_NAME = `boitage-tel-${SW_VERSION}`;

// Fichiers à pré-cacher (offline de base)
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './print-env.css',
  './app.js',
  './manifest.webmanifest',

  // Modèles de lettres
  './letter_moderne.html',
  './letter_historique.html',
  './letter_rurale.html',

  // Enveloppe A4
  './envelope_a4.html',

  // Enveloppe DL Android (le gabarit dédié)
  './print/envelope_dl_android.html',

  // Polices (si tu en utilises localement ; sinon retire-les)
  './fonts/NotoSans-Regular.woff2',
  './fonts/NotoSans-Bold.woff2',
  './fonts/NotoSans-Regular.ttf',
  './fonts/NotoSans-Bold.ttf',

  // Icônes PWA (si présents)
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

// Utilitaire : est-ce une requête "même origine" ?
function isSameOrigin(url) {
  try {
    const u = new URL(url, self.location.origin);
    return u.origin === self.location.origin;
  } catch {
    return false;
  }
}

// Utilitaire : c’est une requête HTML (navigation) ?
function isHTMLRequest(req) {
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('install', (event) => {
  // Installe et active tout de suite
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  // Prend le contrôle immédiatement
  event.waitUntil((async () => {
    // Supprime les vieux caches
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne traite que les GET
  if (req.method !== 'GET') return;

  // Hors domaine : laisser passer (CDN, APIs externes…)
  if (!isSameOrigin(req.url)) {
    return; // Pas d'interception → réseau direct
  }

  // Stratégie 1 — HTML : Network First (retomber sur cache si offline)
  if (isHTMLRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' }); // pas de cache navigateur
        // on met en cache la version fraîche pour l’offline
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req, { ignoreSearch: false });
        if (cached) return cached;
        // Fallback : page d’accueil si dispo
        return cache.match('./index.html', { ignoreSearch: false }) || Response.error();
      }
    })());
    return;
  }

  // Stratégie 2 — Assets : Cache First (puis revalidation en arrière-plan)
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Très important : ignoreSearch **false** → respecte ?v=...
    const cached = await cache.match(req, { ignoreSearch: false });
    if (cached) {
      // Revalidation en arrière-plan pour la prochaine fois
      fetch(req).then((fresh) => {
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
      }).catch(() => {});
      return cached;
    }
    // Pas en cache → réseau
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      // Offline sans cache → 404
      return Response.error();
    }
  })());
});
