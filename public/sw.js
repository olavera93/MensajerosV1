// Service Worker — Logística LFH
// Bump CACHE_NAME en cada deploy para limpiar caché viejo
const CACHE_NAME = 'lfh-v12';

// Solo se guarda lo público: assets compilados, iconos y la pantalla de mensajeros.
// Nada con sesión iniciada (dashboard, reportes, exportaciones) queda en el navegador.
const CACHEABLE = (url) =>
    url.pathname.startsWith('/build/') ||
    url.pathname.startsWith('/icons/') ||
    ['/manifest.json', '/favicon.ico', '/messenger'].includes(url.pathname);

const networkFirst = (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    // Se copia antes de devolverla: después el navegador ya consumió el cuerpo
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
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

    // Lo demás va directo a la red, sin guardar copia
    if (!CACHEABLE(url)) return;

    networkFirst(event);
});
