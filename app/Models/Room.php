<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'description',
        'device_ids',
        'tuya_room_id',
        'last_sync_error',
        'synced_at',
    ];

    protected $casts = [
        'device_ids' => 'array',
        'synced_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
