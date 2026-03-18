<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TuyaConnection extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'client_id',
        'client_secret',
        'access_token',
        'region',
    ];

    protected $hidden = [
        'client_secret',
        'access_token',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
