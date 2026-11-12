<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Guarda el batch de Odoo con el que se generó cada ruta (vacío si vino de un Excel).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('dispatch_logs', function (Blueprint $table) {
            $table->string('source_batch', 100)->nullable()->after('guides_count')->index();
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_logs', function (Blueprint $table) {
            $table->dropIndex(['source_batch']);
            $table->dropColumn('source_batch');
        });
    }
};
