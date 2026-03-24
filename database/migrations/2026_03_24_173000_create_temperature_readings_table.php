<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('temperature_readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('tuya_device_id', 120);
            $table->timestamp('recorded_at');
            $table->timestamp('hour_bucket');
            $table->decimal('value_celsius', 6, 2);
            $table->timestamps();

            $table->unique(['user_id', 'tuya_device_id', 'hour_bucket']);
            $table->index(['user_id', 'hour_bucket']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('temperature_readings');
    }
};
