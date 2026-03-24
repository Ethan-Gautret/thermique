<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TemperatureReading extends Model
{
    protected $fillable = [
        'user_id',
        'tuya_device_id',
        'recorded_at',
        'hour_bucket',
        'value_celsius',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
        'hour_bucket' => 'datetime',
        'value_celsius' => 'float',
    ];
}
