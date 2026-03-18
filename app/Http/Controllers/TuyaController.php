<?php

namespace App\Http\Controllers;

use App\Models\TuyaConnection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Auth;

class TuyaController extends Controller
{
    private $tuyaApiBase = [
        'eu' => 'https://openapi.tuyaeu.com',
        'us' => 'https://openapi.tuyaus.com',
        'cn' => 'https://openapi.tuyacn.com',
        'in' => 'https://openapi.tuyain.com',
    ];

    /**
     * Obtenir la connexion Tuya de l'utilisateur
     */
    public function getConnection(Request $request)
    {
        $connection = TuyaConnection::where('user_id', Auth::id())->first();

        if (!$connection) {
            return response()->json(['message' => 'Aucune connexion Tuya trouvée'], 404);
        }

        return response()->json($connection);
    }

    /**
     * Connecter l'API Tuya
     */
    public function connect(Request $request)
    {
        $validated = $request->validate([
            'clientId' => 'required|string',
            'clientSecret' => 'required|string',
            'region' => 'required|in:eu,us,cn,in',
        ]);

        try {
            // Vérifier les credentials Tuya en obtenant un token
            $token = $this->getTuyaToken(
                $validated['clientId'],
                $validated['clientSecret'],
                $validated['region']
            );

            // Sauvegarder la connexion
            $connection = TuyaConnection::updateOrCreate(
                ['user_id' => Auth::id()],
                [
                    'client_id' => $validated['clientId'],
                    'client_secret' => $validated['clientSecret'],
                    'access_token' => $token,
                    'region' => $validated['region'],
                ]
            );

            return response()->json([
                'message' => 'Connexion Tuya établie avec succès',
                'token' => $token,
                'data' => $connection,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la connexion à Tuya: ' . $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Obtenir un token Tuya
     */
    private function getTuyaToken($clientId, $clientSecret, $region)
    {
        $baseUrl = $this->tuyaApiBase[$region] ?? $this->tuyaApiBase['eu'];

        $response = Http::withoutVerifying()->post("{$baseUrl}/v1.0/token", [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
        ]);

        if (!$response->successful()) {
            throw new \Exception('Identifiants Tuya invalides');
        }

        $data = $response->json();

        if (!isset($data['result']['access_token'])) {
            throw new \Exception('Token non reçu de Tuya');
        }

        return $data['result']['access_token'];
    }

    /**
     * Obtenir la liste des appareils
     */
    public function getDevices(Request $request)
    {
        $connection = TuyaConnection::where('user_id', Auth::id())->first();

        if (!$connection) {
            return response()->json(['message' => 'Tuya non connecté'], 401);
        }

        try {
            $baseUrl = $this->tuyaApiBase[$connection->region] ?? $this->tuyaApiBase['eu'];

            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $connection->access_token,
            ])->get("{$baseUrl}/v1.0/users/me/devices");

            if (!$response->successful()) {
                // Token expiré, tenter de rafraîchir
                if ($response->status() === 401) {
                    $newToken = $this->getTuyaToken(
                        $connection->client_id,
                        $connection->client_secret,
                        $connection->region
                    );

                    $connection->update(['access_token' => $newToken]);

                    $response = Http::withoutVerifying()->withHeaders([
                        'Authorization' => 'Bearer ' . $newToken,
                    ])->get("{$baseUrl}/v1.0/users/me/devices");
                }
            }

            if (!$response->successful()) {
                throw new \Exception('Erreur lors de la récupération des appareils');
            }

            $data = $response->json();

            return response()->json([
                'data' => $data['result'] ?? [],
                'message' => 'Appareils récupérés avec succès',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Contrôler un appareil
     */
    public function controlDevice(Request $request)
    {
        $validated = $request->validate([
            'deviceId' => 'required|string',
            'command' => 'required|string',
            'value' => 'required',
        ]);

        $connection = TuyaConnection::where('user_id', Auth::id())->first();

        if (!$connection) {
            return response()->json(['message' => 'Tuya non connecté'], 401);
        }

        try {
            $baseUrl = $this->tuyaApiBase[$connection->region] ?? $this->tuyaApiBase['eu'];

            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $connection->access_token,
            ])->post("{$baseUrl}/v1.0/iot-03/devices/{$validated['deviceId']}/commands", [
                'commands' => [
                    [
                        'code' => $validated['command'],
                        'value' => $validated['value'],
                    ],
                ],
            ]);

            if (!$response->successful()) {
                throw new \Exception('Erreur lors du contrôle de l\'appareil');
            }

            return response()->json([
                'message' => 'Commande envoyée avec succès',
                'data' => $response->json(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Déconnecter Tuya
     */
    public function disconnect(Request $request)
    {
        TuyaConnection::where('user_id', Auth::id())->delete();

        return response()->json(['message' => 'Déconnexion Tuya réussie']);
    }
}
