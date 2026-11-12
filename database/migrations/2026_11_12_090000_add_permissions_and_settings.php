<?php

use App\Support\Permissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Permisos por acción en lugar de módulos y roles, y tabla de configuración general.
 * Las columnas role y modules se conservan sin cambios para poder revertir.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('permissions')->nullable()->after('modules');
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->timestamps();
        });

        // Cada usuario conserva exactamente el acceso que tenía: módulo completo = todas sus acciones
        foreach (DB::table('users')->get() as $user) {
            $modules = json_decode($user->modules ?? 'null', true) ?: [];
            $groups = match (true) {
                $user->role === 'administrador' => array_keys(Permissions::GROUPS),
                !empty($modules) => array_filter(array_map(fn($m) => Permissions::LEGACY_MODULES[$m] ?? null, $modules)),
                $user->role === 'lider' => array_values(Permissions::LEGACY_MODULES),
                $user->role === 'regente' => ['preoperacional'],
                default => [],
            };

            $permissions = array_merge(...array_map(fn($g) => Permissions::group($g), array_values($groups)) ?: [[]]);

            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode(Permissions::normalize($permissions))]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('permissions');
        });
    }
};
