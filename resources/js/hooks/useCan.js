import { usePage } from '@inertiajs/react';

/**
 * Permisos del usuario actual: const can = useCan(); can('tramites.editar')
 * Solo oculta botones; el servidor vuelve a validar cada acción.
 */
export default function useCan() {
    const permissions = usePage().props.auth?.user?.permissions || [];
    return (...keys) => keys.some((k) => permissions.includes(k));
}
