<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;

// Routes publiques
Route::get('/login', [AuthController::class, 'showLogin'])->name('login')->middleware('guest');
Route::post('/login', [AuthController::class, 'login'])->middleware('guest');

Route::get('/register', [AuthController::class, 'showRegister'])->name('register')->middleware('guest');
Route::post('/register', [AuthController::class, 'register'])->middleware('guest');

// Routes protégées (nécessitent authentification)
Route::middleware('auth')->group(function () {
    Route::get('/', function () {
        return view('welcome');
    });

    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
});


