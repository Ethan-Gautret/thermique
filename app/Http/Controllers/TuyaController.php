<?php

namespace App\Http\Controllers;

use App\Models\TuyaConnection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

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
        $userId = Auth::id();

        if (!$userId) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $connection = TuyaConnection::where('user_id', $userId)->first();

        if (!$connection) {
            return response()->json([
                'connected' => false,
                'message' => 'Aucune connexion Tuya trouvée',
            ]);
        }

        return response()->json([
            'connected' => true,
            'data' => $connection,
        ]);
    }

    /**
     * Connecter l'API Tuya
     */
    public function connect(Request $request)
    {
        $userId = Auth::id();

        if (!$userId) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'clientId' => 'required|string',
            'clientSecret' => 'required|string',
            'region' => 'required|in:eu,us,cn,in',
            'homeId' => 'nullable|string|max:120',
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
                ['user_id' => $userId],
                [
                    'client_id' => $validated['clientId'],
                    'client_secret' => $validated['clientSecret'],
                    'access_token' => $token,
                    'region' => $validated['region'],
                    'home_id' => $validated['homeId'] ?? null,
                ]
            );

            return response()->json([
                'message' => 'Connexion Tuya établie avec succès',
                'connected' => true,
                'data' => $connection,
            ]);
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
        $timestamp = (string) round(microtime(true) * 1000);
        $nonce = bin2hex(random_bytes(8));
        $path = '/v1.0/token?grant_type=1';
        $contentHash = hash('sha256', '');
        $stringToSign = "GET\n{$contentHash}\n\n{$path}";
        $signPayload = $clientId . $timestamp . $nonce . $stringToSign;
        $sign = strtoupper(hash_hmac('sha256', $signPayload, $clientSecret));

        $response = Http::withoutVerifying()
            ->acceptJson()
            ->withHeaders([
                'client_id' => $clientId,
                'sign' => $sign,
                't' => $timestamp,
                'nonce' => $nonce,
                'sign_method' => 'HMAC-SHA256',
            ])
            ->get("{$baseUrl}{$path}");

        $data = $response->json();

        // Compatibilité avec les projets Tuya qui acceptent encore la signature legacy
        if (
            (!$response->successful() || (isset($data['success']) && $data['success'] === false))
            && isset($data['msg'])
            && stripos((string) $data['msg'], 'sign invalid') !== false
        ) {
            $legacyTimestamp = (string) round(microtime(true) * 1000);
            $legacySign = strtoupper(hash_hmac('sha256', $clientId . $legacyTimestamp, $clientSecret));

            $legacyResponse = Http::withoutVerifying()
                ->acceptJson()
                ->withHeaders([
                    'client_id' => $clientId,
                    'sign' => $legacySign,
                    't' => $legacyTimestamp,
                    'sign_method' => 'HMAC-SHA256',
                ])
                ->get("{$baseUrl}{$path}");

            $legacyData = $legacyResponse->json();

            if ($legacyResponse->successful() && (!isset($legacyData['success']) || $legacyData['success'] !== false)) {
                $data = $legacyData;
                $response = $legacyResponse;
            }
        }

        if (!$response->successful()) {
            $message = $data['msg'] ?? 'Réponse HTTP invalide de Tuya';
            Log::warning('Tuya token request failed', [
                'status' => $response->status(),
                'region' => $region,
                'path' => $path,
                'response' => $data,
            ]);
            throw new \Exception('Identifiants Tuya invalides: ' . $message);
        }

        if (isset($data['success']) && $data['success'] === false) {
            $message = $data['msg'] ?? 'Requête refusée par Tuya';
            Log::warning('Tuya token rejected', [
                'region' => $region,
                'path' => $path,
                'response' => $data,
            ]);
            throw new \Exception('Connexion Tuya refusée: ' . $message);
        }

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
        try {
            $connection = TuyaConnection::where('user_id', Auth::id())->first();

            if (!$connection) {
                return response()->json(['message' => 'Tuya non connecté'], 401);
            }

            // Path inclut les query params car ils font partie de la signature Tuya
            $path = '/v2.0/cloud/thing/device?page_no=1&page_size=20';
            
            $response = $this->tuyaSignedGet($connection, $path);
            $payload = $response->json();

            if ($this->shouldRefreshTuyaToken($response, $payload)) {
                $newToken = $this->getTuyaToken(
                    $connection->client_id,
                    $connection->client_secret,
                    $connection->region
                );

                $connection->update(['access_token' => $newToken]);
                $connection->refresh();

                $response = $this->tuyaSignedGet($connection, $path);
                $payload = $response->json();
            }

            if (!$response->successful() || (isset($payload['success']) && $payload['success'] === false)) {
                $message = $payload['msg'] ?? 'Erreur lors de la récupération des appareils';

                Log::warning('Tuya devices request failed', [
                    'status' => $response->status(),
                    'region' => $connection->region,
                    'path' => $path,
                    'response' => $payload,
                ]);

                throw new \Exception($message);
            }

            $result = $payload['result'] ?? [];
            $rawDevices = (is_array($result) && array_is_list($result))
                ? $result
                : ($result['list'] ?? []);

            $devices = collect($rawDevices)->map(function ($device) {
                return [
                    'id' => $device['id'] ?? null,
                    'name' => $device['name'] ?? 'Equipement sans nom',
                    'category' => $device['category'] ?? 'inconnu',
                    'online' => (bool) ($device['isOnline'] ?? $device['online'] ?? false),
                    'model' => $device['model'] ?? null,
                    'productName' => $device['productName'] ?? null,
                    'ip' => $device['ip'] ?? null,
                    'lastSeen' => $device['updateTime'] ?? null,
                ];
            })->values();

            return response()->json([
                'data' => $devices,
                'message' => 'Appareils récupérés avec succès',
            ]);
        } catch (\PDOException $e) {
            Log::error('Database connection error in getDevices', ['exception' => $e->getMessage()]);
            return response()->json([
                'message' => 'Erreur de connexion à la base de données. Vérifiez que MySQL est démarré.',
            ], 500);
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

    private function tuyaSignedGet(TuyaConnection $connection, string $path)
    {
        $baseUrl = $this->tuyaApiBase[$connection->region] ?? $this->tuyaApiBase['eu'];
        $timestamp = (string) round(microtime(true) * 1000);
        $nonce = bin2hex(random_bytes(8));
        $contentHash = hash('sha256', '');
        $stringToSign = "GET\n{$contentHash}\n\n{$path}";
        $signPayload = $connection->client_id . $connection->access_token . $timestamp . $nonce . $stringToSign;
        $sign = strtoupper(hash_hmac('sha256', $signPayload, $connection->client_secret));

        return Http::withoutVerifying()
            ->acceptJson()
            ->withHeaders([
                'client_id' => $connection->client_id,
                'access_token' => $connection->access_token,
                'sign' => $sign,
                't' => $timestamp,
                'nonce' => $nonce,
                'sign_method' => 'HMAC-SHA256',
            ])
            ->get("{$baseUrl}{$path}");
    }

    private function shouldRefreshTuyaToken($response, array $payload): bool
    {
        if ($response->status() === 401) {
            return true;
        }

        if (!isset($payload['code'])) {
            return false;
        }

        return in_array((int) $payload['code'], [1010, 1011], true);
    }
}
