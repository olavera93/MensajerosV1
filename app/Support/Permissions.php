<?php

namespace App\Support;

use App\Models\User;

/**
 * Catálogo de permisos por acción. Cada módulo tiene un permiso "ver" y acciones adicionales;
 * cualquier acción implica poder ver el módulo.
 */
class Permissions
{
    public const GROUPS = [
        'dashboard' => ['label' => 'Dashboard', 'icon' => '🏠', 'route' => 'dashboard', 'actions' => [
            'ver' => 'Ver', 'asignar_ruta' => 'Asignar ruta',
        ]],
        'horarios' => ['label' => 'Horarios', 'icon' => '🕒', 'route' => 'shifts.index', 'actions' => [
            'ver' => 'Ver', 'editar' => 'Crear, importar y eliminar', 'exportar' => 'Exportar',
        ]],
        'mensajeros' => ['label' => 'Mensajeros', 'icon' => '🛵', 'route' => 'messengers.index', 'actions' => [
            'ver' => 'Ver', 'editar' => 'Crear y editar', 'eliminar' => 'Eliminar',
        ]],
        'almuerzo' => ['label' => 'Almuerzo', 'icon' => '🍽️', 'route' => 'reports.lunch', 'actions' => [
            'ver' => 'Ver', 'exportar' => 'Exportar',
        ]],
        'preoperacional' => ['label' => 'Preoperacional', 'icon' => '📋', 'route' => 'reports.preoperational', 'actions' => [
            'ver' => 'Ver', 'exportar' => 'Exportar', 'preguntas' => 'Gestionar preguntas',
        ]],
        'aseo' => ['label' => 'Aseo', 'icon' => '✨', 'route' => 'reports.cleaning', 'actions' => [
            'ver' => 'Ver', 'exportar' => 'Exportar',
        ]],
        'estadisticas' => ['label' => 'Estadísticas', 'icon' => '📊', 'route' => 'reports.global-stats', 'actions' => [
            'ver' => 'Ver', 'exportar' => 'Exportar',
        ]],
        'salida' => ['label' => 'Salida', 'icon' => '🏁', 'route' => 'reports.exit', 'actions' => [
            'ver' => 'Ver', 'exportar' => 'Exportar', 'sincronizar' => 'Sincronizar con DispatchTrack',
        ]],
        'formularios' => ['label' => 'Formularios', 'icon' => '📝', 'route' => 'external-forms.index', 'actions' => [
            'ver' => 'Ver', 'editar' => 'Crear y eliminar',
        ]],
        'tramites' => ['label' => 'Trámites', 'icon' => '💼', 'route' => 'procedures.index', 'actions' => [
            'ver' => 'Ver', 'editar' => 'Crear, editar e importar', 'eliminar' => 'Eliminar', 'exportar' => 'Exportar',
        ]],
        'usuarios' => ['label' => 'Usuarios', 'icon' => '👤', 'route' => 'users.index', 'actions' => [
            'ver' => 'Ver', 'editar' => 'Crear y editar', 'eliminar' => 'Eliminar',
        ]],
        'configuracion' => ['label' => 'Configuración', 'icon' => '⚙️', 'route' => 'settings.index', 'actions' => [
            'ver' => 'Ver', 'editar' => 'Editar',
        ]],
    ];

    /** Módulos anteriores → grupo de permisos equivalente (para migrar usuarios existentes). */
    public const LEGACY_MODULES = [
        'dashboard' => 'dashboard', 'shifts.index' => 'horarios', 'messengers.index' => 'mensajeros',
        'reports.lunch' => 'almuerzo', 'reports.exit' => 'salida', 'reports.preoperational' => 'preoperacional',
        'reports.cleaning' => 'aseo', 'reports.global-stats' => 'estadisticas',
        'external-forms.index' => 'formularios', 'users.index' => 'usuarios', 'procedures.index' => 'tramites',
    ];

    public static function all(): array
    {
        $all = [];
        foreach (self::GROUPS as $group => $def) {
            foreach (array_keys($def['actions']) as $action) {
                $all[] = "$group.$action";
            }
        }
        return $all;
    }

    public static function group(string $group): array
    {
        return array_map(fn($a) => "$group.$a", array_keys(self::GROUPS[$group]['actions'] ?? []));
    }

    /**
     * Deja solo permisos válidos, sin duplicados, y agrega "ver" a cada módulo que tenga alguna acción.
     */
    public static function normalize(?array $permissions): array
    {
        $valid = array_values(array_intersect(array_unique($permissions ?? []), self::all()));
        foreach ($valid as $p) {
            $view = explode('.', $p)[0] . '.ver';
            if (!in_array($view, $valid)) {
                $valid[] = $view;
            }
        }
        return array_values(array_intersect(self::all(), $valid)); // orden del catálogo
    }

    public static function for(?User $user): array
    {
        if (!$user) {
            return [];
        }
        return $user->isDeveloper() ? self::all() : self::normalize($user->permissions);
    }

    /** Catálogo para el frontend. */
    public static function catalog(): array
    {
        return collect(self::GROUPS)->map(fn($def, $key) => [
            'key' => $key,
            'label' => $def['label'],
            'icon' => $def['icon'],
            'route' => $def['route'],
            'actions' => collect($def['actions'])->map(fn($label, $a) => ['key' => "$key.$a", 'label' => $label])->values(),
        ])->values()->all();
    }
}
