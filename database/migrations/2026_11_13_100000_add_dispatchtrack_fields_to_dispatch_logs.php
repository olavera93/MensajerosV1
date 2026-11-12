<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Seguimiento de las rutas enviadas directamente a DispatchTrack (importación del rutero).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('dispatch_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->after('location_id');
            $table->string('dt_status', 20)->nullable()->after('source_batch'); // queued, created, not_found
            $table->string('dt_route_id', 50)->nullable()->after('dt_status');
            $table->string('dt_truck', 30)->nullable()->after('dt_route_id');
            $table->json('dt_guides')->nullable()->after('dt_truck');
            $table->timestamp('dt_sent_at')->nullable()->after('dt_guides');
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_logs', function (Blueprint $table) {
            $table->dropColumn(['user_id', 'dt_status', 'dt_route_id', 'dt_truck', 'dt_guides', 'dt_sent_at']);
        });
    }
};
