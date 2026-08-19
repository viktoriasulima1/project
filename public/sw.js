const SW_VERSION = 'sw-clone-fix-v2';
const STATIC_CACHE = `farmos-static-${SW_VERSION}`;
const SAFE_STATIC = ['/offline.html', '/manifest.webmanifest', '/window.svg'];
// Dev-only console logging for failed cache writes (never in production).
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(SAFE_STATIC)));
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FARMOS_VERSION') event.ports[0]?.postMessage({ version: SW_VERSION });
});

self.addEventListener('activate', (event) => {
  // Remove obsolete FarmOS SW *caches* only, then claim clients. IndexedDB
  // (offline drafts + sync queue) is owned by the app and is NEVER touched
  // here — a worker upgrade must not lose a farmer's unsynced work.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Only versioned static assets + a tiny public shell allowlist are cached.
  // Authenticated HTML, RSC payloads, Server Actions, /api/*, Clerk requests,
  // private scouting photos and signed URLs are NEVER cached — IndexedDB (with
  // account + farm isolation) is the only owner of offline business data.
  const isSafeStatic = url.pathname.startsWith('/_next/static/') || SAFE_STATIC.includes(url.pathname);
  if (isSafeStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Clone SYNCHRONOUSLY here, while the body is still untouched. Cloning
          // later (inside the async caches.open().then()) throws "Response body
          // is already used" because `return response` has meanwhile handed the
          // original to the browser, which has begun reading its body. The clone
          // is the cache's owner; the original is returned to the page.
          if (response.ok) {
            const responseForCache = response.clone();
            event.waitUntil(
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, responseForCache))
                // A failed cache write must never reject the fetch or surface an
                // unhandled rejection — the network response is already served.
                .catch((error) => { if (IS_DEV) console.warn('[FarmOS SW] cache write skipped:', error && error.message); }),
            );
          }
          return response;
        });
      }),
    );
    return;
  }

  // Navigations stay network-first; the offline shell is served only on a real
  // network failure. Authenticated navigation HTML is never cached.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
  }
});
