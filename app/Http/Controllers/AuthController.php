<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function showLogin()
    {
        return view('auth.login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (Auth::attempt($credentials)) {
            // Si c'est une requête normalisée (non-API), régénérer la session
            if (!$request->expectsJson()) {
                $request->session()->regenerate();
            }

            $user = Auth::user();

            // Si c'est une requête API (JSON), générer un token Sanctum
            if ($request->expectsJson()) {
                $token = $user->createToken('auth-token')->plainTextToken;
                return response()->json([
                    'token' => $token,
                    'user' => $user,
                    'message' => 'Connecté avec succès'
                ]);
            }

            return redirect()->intended('/');
        }

        $message = 'Email ou mot de passe incorrect.';

        if ($request->expectsJson()) {
            return response()->json(['message' => $message], 401);
        }

        return back()->withErrors([
            'email' => $message,
        ])->onlyInput('email');
    }

    public function showRegister()
    {
        return view('auth.register');
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'user',
        ]);

        // Si c'est une requête API, générer un token Sanctum
        if ($request->expectsJson()) {
            $token = $user->createToken('auth-token')->plainTextToken;
            return response()->json([
                'token' => $token,
                'user' => $user,
                'message' => 'Inscription réussie'
            ], 201);
        }

        return redirect('/login')->with('success', 'Inscription réussie ! Connectez-vous maintenant.');
    }

    public function logout(Request $request)
    {
        // Si c'est une requête API, révoquer le token
        if ($request->expectsJson()) {
            $request->user()->currentAccessToken()->delete();
            return response()->json(['message' => 'Déconnecté']);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect('/');
    }

    public function user(Request $request)
    {
        if (!Auth::check()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $user = Auth::user();
        $user->load('group');

        return response()->json($user);
    }
}
