<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TestController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\TuyaController;
use App\Http\Controllers\SiteZoneController;

Route::get('/test', [TestController::class, 'index']);

// Routes d'authentification
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// Routes protégées
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Routes Tuya
    Route::prefix('tuya')->group(function () {
        Route::get('/connection', [TuyaController::class, 'getConnection']);
        Route::post('/connect', [TuyaController::class, 'connect']);
        Route::get('/devices', [TuyaController::class, 'getDevices']);
        Route::post('/device/control', [TuyaController::class, 'controlDevice']);
        Route::post('/disconnect', [TuyaController::class, 'disconnect']);
    });

    Route::prefix('sites-zones')->group(function () {
        Route::get('/rooms', [SiteZoneController::class, 'index']);
        Route::post('/rooms', [SiteZoneController::class, 'store']);
        Route::put('/rooms/{room}', [SiteZoneController::class, 'update']);
        Route::delete('/rooms/{room}', [SiteZoneController::class, 'destroy']);
    });
});