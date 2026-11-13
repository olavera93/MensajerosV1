<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->dateTime('start_datetime');
            $table->dateTime('end_datetime');
            $table->enum('scope', ['all', 'specific'])->default('all');
            $table->timestamps();
        });

        Schema::create('event_messenger', function (Blueprint $table) {
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->foreignId('messenger_id')->constrained()->onDelete('cascade');
            $table->primary(['event_id', 'messenger_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_messenger');
        Schema::dropIfExists('events');
    }
};
