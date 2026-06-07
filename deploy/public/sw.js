// Service Worker — Logística LFH
// Bump CACHE_NAME en cada deploy para limpiar caché viejo
const CACHE_NAME = 'lfh-v10';

const networkFirst = (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
};

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo GET del mismo origen
    if (request.method !== 'GET' || url.origin !== location.origin) return;

    // Dejar pasar XHR de Inertia (datos dinámicos, no cachear)
    if (request.headers.get('X-Inertia')) return;

    // NetworkFirst para todo lo demás: HTML, assets, iconos
    networkFirst(event);
});
