/**
 * Cabecera CSRF para peticiones fetch.
 * El token del <meta> se escribe al cargar la página y queda viejo cuando la sesión cambia sin
 * recargarla (p. ej. al iniciar sesión con Inertia). La cookie XSRF-TOKEN siempre trae el vigente.
 */
export default function csrfHeaders() {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
    if (cookie) return { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) };
    return { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' };
}
