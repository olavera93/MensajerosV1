<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'desarrollador')
            ->update(['role' => 'administrador']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data-only migration; original role values are not tracked, so this is not reversible.
    }
};
