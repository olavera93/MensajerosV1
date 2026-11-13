<?php

use App\Support\Permissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Recupera el módulo Eventos dentro de los permisos por acción. Reciben "Eventos · Ver" y
 * "Eventos · Crear, editar y eliminar" quienes ya lo tenían (módulo events.index o rol administrador)
 * y los administradores actuales (quienes editan la Configuración).
 */
return new class extends Migration {
    private const PERMISSIONS = ['eventos.ver', 'eventos.editar'];

    public function up(): void
    {
        foreach (DB::table('users')->get() as $user) {
            $permissions = json_decode($user->permissions ?? '[]', true) ?: [];
            $modules = json_decode($user->modules ?? '[]', true) ?: [];

            $hadEvents = $user->role === 'administrador'
                || in_array('events.index', $modules)
                || in_array('configuracion.editar', $permissions);

            if ($hadEvents && array_diff(self::PERMISSIONS, $permissions)) {
                DB::table('users')->where('id', $user->id)->update([
                    'permissions' => json_encode(Permissions::normalize(array_merge($permissions, self::PERMISSIONS))),
                ]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('users')->get() as $user) {
            $permissions = json_decode($user->permissions ?? '[]', true) ?: [];
            if (array_intersect(self::PERMISSIONS, $permissions)) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(array_values(array_diff($permissions, self::PERMISSIONS)))]);
            }
        }
    }
};
