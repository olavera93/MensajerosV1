// Service Worker — Logística LFH
// Bump this version string on every deploy to force cache invalidation
const CACHE_VERSION = 'lfh-v2';
const ASSETS_CACHE  = `${CACHE_VERSION}-assets`;

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== ASSETS_CACHE)
                    .map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET, cross-origin, Inertia XHR, API calls
    if (
        event.request.method !== 'GET' ||
        url.origin !== location.origin ||
        event.request.headers.get('X-Inertia') ||
        url.pathname.startsWith('/api/')
    ) {
        return;
    }

    // HTML (navigation requests) — always network, never cache
    if (event.request.mode === 'navigate') {
        return;
    }

    // Vite build assets (/build/...) — cache-first (safe: content-hashed filenames)
    if (url.pathname.startsWith('/build/')) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(ASSETS_CACHE).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Everything else (icons, images, etc.) — network-first, no caching
});
