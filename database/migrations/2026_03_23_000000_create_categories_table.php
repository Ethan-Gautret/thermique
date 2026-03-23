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
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->string('icon', 50)->default('📁');
            $table->string('color', 7)->default('#6366f1');
            $table->integer('order')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'name']);
        });

        // Ajouter la colonne category_id à la table devices
        Schema::table('rooms', function (Blueprint $table) {
            if (!Schema::hasColumn('rooms', 'category_id')) {
                $table->foreignId('category_id')->nullable()->constrained('categories')->cascadeOnDelete()->after('id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            if (Schema::hasColumn('rooms', 'category_id')) {
                $table->dropColumn('category_id');
            }
        });

        Schema::dropIfExists('categories');
    }
};
