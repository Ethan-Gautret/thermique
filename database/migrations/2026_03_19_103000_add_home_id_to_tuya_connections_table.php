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
        Schema::table('tuya_connections', function (Blueprint $table) {
            if (!Schema::hasColumn('tuya_connections', 'home_id')) {
                $table->string('home_id', 120)->nullable()->after('region');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tuya_connections', function (Blueprint $table) {
            if (Schema::hasColumn('tuya_connections', 'home_id')) {
                $table->dropColumn('home_id');
            }
        });
    }
};
