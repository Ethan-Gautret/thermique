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
        Schema::table('rooms', function (Blueprint $table) {
            if (!Schema::hasColumn('rooms', 'tuya_room_id')) {
                $table->string('tuya_room_id', 120)->nullable()->after('device_ids');
            }

            if (!Schema::hasColumn('rooms', 'last_sync_error')) {
                $table->text('last_sync_error')->nullable()->after('tuya_room_id');
            }

            if (!Schema::hasColumn('rooms', 'synced_at')) {
                $table->timestamp('synced_at')->nullable()->after('last_sync_error');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $dropColumns = [];

            if (Schema::hasColumn('rooms', 'synced_at')) {
                $dropColumns[] = 'synced_at';
            }

            if (Schema::hasColumn('rooms', 'last_sync_error')) {
                $dropColumns[] = 'last_sync_error';
            }

            if (Schema::hasColumn('rooms', 'tuya_room_id')) {
                $dropColumns[] = 'tuya_room_id';
            }

            if (!empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
