<?php

use App\Support\Permissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Los administradores (quienes editan la Configuración) reciben el permiso nuevo
 * "Dashboard · Crear ruta en DispatchTrack" para poder usarlo y otorgarlo a otros usuarios.
 */
return new class extends Migration {
    private const PERMISSION = 'dashboard.crear_ruta_dt';

    public function up(): void
    {
        foreach (DB::table('users')->get() as $user) {
            $permissions = json_decode($user->permissions ?? '[]', true) ?: [];
            if (in_array('configuracion.editar', $permissions) && !in_array(self::PERMISSION, $permissions)) {
                $permissions[] = self::PERMISSION;
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(Permissions::normalize($permissions))]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('users')->get() as $user) {
            $permissions = json_decode($user->permissions ?? '[]', true) ?: [];
            if (in_array(self::PERMISSION, $permissions)) {
                DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(array_values(array_diff($permissions, [self::PERMISSION])))]);
            }
        }
    }
};
