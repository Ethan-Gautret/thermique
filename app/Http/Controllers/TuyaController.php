<?php

namespace App\Http\Controllers;

use App\Models\Room;
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
            $tokenData = $this->getTuyaTokenData(
                $validated['clientId'],
                $validated['clientSecret'],
                $validated['region']
            );

            $token = $tokenData['accessToken'];
            $uid = $tokenData['uid'];

            $homeId = $validated['homeId'] ?? null;
            $discoveredHomeIds = [];

            if (empty($homeId)) {
                $discoveredHomeIds = $this->discoverHomeIds(
                    $validated['clientId'],
                    $validated['clientSecret'],
                    $validated['region'],
                    $token,
                    $uid
                );

                if (!empty($discoveredHomeIds)) {
                    $homeId = (string) $discoveredHomeIds[0];
                }
            }

            // Sauvegarder la connexion
            $connection = TuyaConnection::updateOrCreate(
                ['user_id' => $userId],
                [
                    'client_id' => $validated['clientId'],
                    'client_secret' => $validated['clientSecret'],
                    'access_token' => $token,
                    'region' => $validated['region'],
                    'home_id' => $homeId,
                ]
            );

            $message = 'Connexion Tuya établie avec succès';

            if (!empty($homeId) && empty($validated['homeId'])) {
                $message = 'Connexion Tuya établie avec succès. Home ID détecté automatiquement.';
            }

            if (count($discoveredHomeIds) > 1) {
                $message .= ' Plusieurs homes détectés, le premier a été sélectionné.';
            }

            if (empty($homeId)) {
                $message .= ' Aucun Home ID détecté automatiquement. Vous pouvez le renseigner manuellement.';
            }

            return response()->json([
                'message' => $message,
                'connected' => true,
                'data' => $connection,
                'meta' => [
                    'homeIdsDetected' => $discoveredHomeIds,
                ],
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
        return $this->getTuyaTokenData($clientId, $clientSecret, $region)['accessToken'];
    }

    /**
     * Obtenir le token Tuya et les metadonnees disponibles (uid)
     */
    private function getTuyaTokenData($clientId, $clientSecret, $region): array
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

        return [
            'accessToken' => $data['result']['access_token'],
            'uid' => $data['result']['uid'] ?? null,
        ];
    }

    private function discoverHomeIds(
        string $clientId,
        string $clientSecret,
        string $region,
        string $accessToken,
        ?string $uid
    ): array {
        $paths = [];

        if (!empty($uid)) {
            $paths[] = "/v1.0/users/{$uid}/homes";
            $paths[] = "/v1.0/users/{$uid}/families";
        }

        $paths[] = '/v1.0/homes';
        $paths[] = '/v1.0/families';

        foreach ($paths as $path) {
            try {
                $response = $this->tuyaSignedGetWithCredentials(
                    $clientId,
                    $clientSecret,
                    $accessToken,
                    $region,
                    $path
                );

                $payload = $response->json() ?: [];

                if (!$response->successful() || (isset($payload['success']) && $payload['success'] === false)) {
                    continue;
                }

                $homeIds = $this->extractHomeIdsFromPayload($payload);
                if (!empty($homeIds)) {
                    return array_values(array_unique($homeIds));
                }
            } catch (\Throwable $e) {
                Log::debug('Tuya home discovery path failed', [
                    'path' => $path,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Fallback: certains comptes exposent seulement bindSpaceId/home_id via la liste devices.
        try {
            $deviceResponse = $this->tuyaSignedGetWithCredentials(
                $clientId,
                $clientSecret,
                $accessToken,
                $region,
                '/v2.0/cloud/thing/device?page_no=1&page_size=20'
            );

            $devicePayload = $deviceResponse->json() ?: [];
            if ($deviceResponse->successful() && (!isset($devicePayload['success']) || $devicePayload['success'] !== false)) {
                $deviceResult = $devicePayload['result'] ?? [];
                $deviceList = (is_array($deviceResult) && array_is_list($deviceResult))
                    ? $deviceResult
                    : ($deviceResult['list'] ?? []);

                $homeIds = collect($deviceList)
                    ->map(function ($device) {
                        if (!is_array($device)) {
                            return null;
                        }

                        return $device['bindSpaceId']
                            ?? $device['home_id']
                            ?? $device['homeId']
                            ?? $device['family_id']
                            ?? null;
                    })
                    ->filter(fn ($value) => is_scalar($value) && (string) $value !== '')
                    ->map(fn ($value) => (string) $value)
                    ->unique()
                    ->values()
                    ->all();

                if (!empty($homeIds)) {
                    return $homeIds;
                }
            }
        } catch (\Throwable $e) {
            Log::debug('Tuya home discovery fallback by devices failed', [
                'error' => $e->getMessage(),
            ]);
        }

        return [];
    }

    private function extractHomeIdsFromPayload(array $payload): array
    {
        $result = $payload['result'] ?? null;

        if (is_scalar($result)) {
            return [(string) $result];
        }

        if (!is_array($result)) {
            return [];
        }

        $containers = [];

        if (array_is_list($result)) {
            $containers[] = $result;
        }

        foreach (['list', 'homes', 'families', 'data'] as $key) {
            if (isset($result[$key]) && is_array($result[$key])) {
                $containers[] = $result[$key];
            }
        }

        if (isset($result['id']) && is_scalar($result['id'])) {
            return [(string) $result['id']];
        }

        $homeIds = [];

        foreach ($containers as $items) {
            if (!is_array($items)) {
                continue;
            }

            foreach ($items as $item) {
                if (is_array($item)) {
                    $candidate = $item['id'] ?? $item['home_id'] ?? $item['family_id'] ?? null;
                    if (is_scalar($candidate)) {
                        $homeIds[] = (string) $candidate;
                    }
                } elseif (is_scalar($item)) {
                    $homeIds[] = (string) $item;
                }
            }
        }

        return $homeIds;
    }

    private function tuyaSignedGetWithCredentials(
        string $clientId,
        string $clientSecret,
        string $accessToken,
        string $region,
        string $path
    ) {
        $baseUrl = $this->tuyaApiBase[$region] ?? $this->tuyaApiBase['eu'];
        $timestamp = (string) round(microtime(true) * 1000);
        $nonce = bin2hex(random_bytes(8));
        $contentHash = hash('sha256', '');
        $stringToSign = "GET\n{$contentHash}\n\n{$path}";
        $signPayload = $clientId . $accessToken . $timestamp . $nonce . $stringToSign;
        $sign = strtoupper(hash_hmac('sha256', $signPayload, $clientSecret));

        return Http::withoutVerifying()
            ->acceptJson()
            ->withHeaders([
                'client_id' => $clientId,
                'access_token' => $accessToken,
                'sign' => $sign,
                't' => $timestamp,
                'nonce' => $nonce,
                'sign_method' => 'HMAC-SHA256',
            ])
            ->get("{$baseUrl}{$path}");
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

            $rooms = Room::where('user_id', Auth::id())
                ->get(['id', 'category_id', 'device_ids']);

            $deviceCategoryById = [];
            foreach ($rooms as $room) {
                $deviceIds = is_array($room->device_ids) ? $room->device_ids : [];
                foreach ($deviceIds as $id) {
                    if (is_scalar($id) && (string) $id !== '') {
                        $deviceCategoryById[(string) $id] = $room->category_id;
                    }
                }
            }

            $devices = collect($rawDevices)->map(function ($device) use ($connection, $deviceCategoryById) {
                $powerState = null;
                
                // Récupérer l'état on/off de l'appareil
                try {
                    // Essayer le endpoint IoT v1.0
                    $statusPath = '/v1.0/iot-03/devices/' . ($device['id'] ?? '') . '/status';
                    $statusResponse = $this->tuyaSignedGet($connection, $statusPath);
                    $statusPayload = $statusResponse->json();

                    Log::debug('Device status response', [
                        'device_id' => $device['id'] ?? null,
                        'device_name' => $device['name'] ?? null,
                        'endpoint' => $statusPath,
                        'response_status' => $statusResponse->status(),
                        'response_payload' => $statusPayload,
                    ]);

                    if ($statusResponse->successful() && isset($statusPayload['result'])) {
                        $properties = $statusPayload['result'];
                        
                        Log::debug('Device properties parsed', [
                            'device_id' => $device['id'] ?? null,
                            'properties_count' => is_array($properties) ? count($properties) : 0,
                            'properties_structure' => $properties,
                        ]);

                        if (is_array($properties) && !empty($properties)) {
                            // Chercher la propriété de puissance (power ou switch)
                            foreach ($properties as $property) {
                                if (isset($property['code'])) {
                                    $code = strtolower($property['code']);
                                    if (strpos($code, 'switch') !== false || strpos($code, 'power') !== false) {
                                        $powerState = (bool) $property['value'];
                                        Log::debug('Found power property', [
                                            'device_id' => $device['id'] ?? null,
                                            'code' => $property['code'],
                                            'value' => $powerState,
                                        ]);
                                        break;
                                    }
                                }
                            }
                            // Si pas trouvée, prendre la première propriété
                            if ($powerState === null && isset($properties[0]['value'])) {
                                $powerState = (bool) $properties[0]['value'];
                                Log::debug('Using first property as power state', [
                                    'device_id' => $device['id'] ?? null,
                                    'first_property' => $properties[0],
                                    'value' => $powerState,
                                ]);
                            }
                        }
                    }
                } catch (\Exception $e) {
                    Log::warning('Could not fetch device status', [
                        'device_id' => $device['id'] ?? null,
                        'error' => $e->getMessage(),
                    ]);
                }

                return [
                    'id' => $device['id'] ?? null,
                    'name' => $device['name'] ?? 'Equipement sans nom',
                    'category' => $device['category'] ?? 'inconnu',
                    'category_id' => isset($device['id']) ? ($deviceCategoryById[(string) $device['id']] ?? null) : null,
                    'online' => (bool) ($device['isOnline'] ?? $device['online'] ?? false),
                    'powerOn' => $powerState,
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

    /**
     * Mettre à jour la catégorie d'un équipement
     */
    public function updateDeviceCategory(Request $request, $deviceId)
    {
        try {
            $validated = $request->validate([
                'category_id' => 'nullable|integer|exists:categories,id',
            ]);

            // Chercher un room qui contient déjà cet appareil Tuya
            $room = Room::where('user_id', $request->user()->id)
                ->whereJsonContains('device_ids', (string) $deviceId)
                ->first();

            // Si aucun room n'existe pour cet appareil, en créer un dédié
            if (!$room) {
                $room = Room::create([
                    'user_id' => $request->user()->id,
                    'name' => 'Appareil ' . $deviceId,
                    'device_ids' => [(string) $deviceId],
                    'category_id' => null,
                ]);
            }

            // Vérifier que la catégorie (si fournie) appartient à l'utilisateur
            $categoryId = $validated['category_id'] ?? null;
            if ($categoryId) {
                $request->user()
                    ->categories()
                    ->where('id', $validated['category_id'])
                    ->firstOrFail();
            }

            $room->update([
                'category_id' => $categoryId,
            ]);

            return response()->json([
                'message' => 'Catégorie de l\'équipement mise à jour avec succès',
                'data' => $room,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Équipement ou catégorie non trouvé',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error updating device category', [
                'device_id' => $deviceId,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'message' => 'Erreur lors de la mise à jour de la catégorie',
            ], 500);
        }
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
