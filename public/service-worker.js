/**
 * Service Worker — Absensi Sekolah (MI Miftahul Ulum Sumberwuluh)
 *
 * STRICT SECURITY & PRIVACY CACHE POLICY (Tahap 10):
 * - Caches ONLY static shell assets (JS/CSS/fonts/static icons) and `/offline.html`.
 * - NEVER caches `/api/*` responses, attendance scans, selfies, attachments, QR tokens,
 *   session cookies, or any private user/student/teacher data.
 * - Controlled update flow: waits until the user triggers `SKIP_WAITING` via the UI banner.
 */

const STATIC_CACHE = 'absensi-static-v3';
const STATIC_PRECACHE_URLS = ['/offline.html', '/icon.svg'];

const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

function isSensitiveOrApiPath(pathname) {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.includes('/uploads')) return true;
  if (pathname.includes('/selfie')) return true;
  if (pathname.includes('/qr')) return true;
  if (pathname.includes('/attendance')) return true;
  if (pathname.includes('/permissions')) return true;
  if (pathname.includes('/audit-logs')) return true;
  if (pathname.includes('/backup')) return true;
  if (pathname === '/manifest.webmanifest') return true;
  return false;
}

function isDynamicBrandingIconPath(pathname) {
  return (
    pathname.startsWith('/icons/') ||
    pathname === '/favicon.png' ||
    pathname === '/apple-touch-icon.png'
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_PRECACHE_URLS)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept non-GET methods (POST/PATCH/DELETE mutations)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // NEVER cache API routes, private assets, branding API, or dynamic manifest
  if (isSensitiveOrApiPath(url.pathname)) {
    return;
  }

  // Branding & PWA icons: always fetch fresh from network first so uploaded logo updates immediately
  if (isDynamicBrandingIconPath(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)),
    );
    return;
  }

  // Navigation requests: Network-first, fallback to /offline.html when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedOffline = await caches.match('/offline.html');
        return (
          cachedOffline ||
          new Response('Anda sedang offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      }),
    );
    return;
  }

  // Static assets only (bundled JS/CSS/fonts under /assets or /icon.svg)
  const isStaticAsset =
    STATIC_DESTINATIONS.has(request.destination) &&
    (url.pathname.startsWith('/assets/') || url.pathname === '/icon.svg');

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const clone = networkResponse.clone();
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, clone);
      }
      return networkResponse;
    }),
  );
});
