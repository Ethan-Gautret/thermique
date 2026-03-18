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
        Schema::create('tuya_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('client_id');
            $table->string('client_secret');
            $table->text('access_token')->nullable();
            $table->enum('region', ['eu', 'us', 'cn', 'in'])->default('eu');
            $table->timestamps();

            // Un utilisateur ne peut avoir qu'une seule connexion Tuya
            $table->unique('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tuya_connections');
    }
};
