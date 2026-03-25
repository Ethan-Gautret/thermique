<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\Site;
use App\Models\TuyaConnection;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SiteZoneController extends Controller
{
    private array $tuyaApiBase = [
        'eu' => 'https://openapi.tuyaeu.com',
        'us' => 'https://openapi.tuyaus.com',
        'cn' => 'https://openapi.tuyacn.com',
        'in' => 'https://openapi.tuyain.com',
    ];

    public function sitesIndex()
    {
        $sites = Site::where('user_id', Auth::id())
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $sites->map(fn (Site $site) => $this->transformSite($site))->values(),
        ]);
    }

    public function sitesStore(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'address' => 'nullable|string|max:500',
        ]);

        $site = Site::create([
            'user_id' => Auth::id(),
            'name' => $validated['name'],
            'address' => $validated['address'] ?? null,
        ]);

        return response()->json([
            'message' => 'Site cree avec succes.',
            'data' => $this->transformSite($site),
        ], 201);
    }

    public function sitesDestroy(Site $site)
    {
        // Verify the site belongs to the authenticated user
        if ($site->user_id !== Auth::id()) {
            return response()->json([
                'message' => 'Non autorise.',
            ], 403);
        }

        // Delete all rooms associated with this site
        Room::where('site_id', $site->id)->update(['site_id' => null]);

        $site->delete();

        return response()->json([
            'message' => 'Site supprime avec succes.',
        ], 200);
    }

    public function index()
    {
        $rooms = Room::where('user_id', Auth::id())
            ->with('site')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $rooms->map(fn (Room $room) => $this->transformRoom($room))->values(),
        ]);
    }

    /**
     * Synchronise les pièces depuis l'API Tuya Cloud
     */
    public function syncFromTuya()
    {
        $connection = TuyaConnection::where('user_id', Auth::id())->first();

        if (!$connection) {
            return response()->json([
                'message' => 'Aucune connexion Tuya configurée.',
            ], 400);
        }

        if (empty($connection->home_id)) {
            return response()->json([
                'message' => 'Home ID manquant. Veuillez le configurer dans les paramètres.',
            ], 400);
        }

        try {
            $tuyaRooms = $this->fetchTuyaRooms($connection);

            if (empty($tuyaRooms)) {
                return response()->json([
                    'message' => 'Aucune pièce trouvée sur Tuya.',
                    'data' => [],
                ]);
            }

            $synced = [];
            foreach ($tuyaRooms as $tuyaRoom) {
                if (!is_array($tuyaRoom)) {
                    continue;
                }

                $tuyaRoomId = $tuyaRoom['id'] ?? $tuyaRoom['room_id'] ?? null;
                $tuyaRoomName = $tuyaRoom['name'] ?? null;

                if (!is_scalar($tuyaRoomId) || !is_scalar($tuyaRoomName)) {
                    continue;
                }

                $room = Room::updateOrCreate(
                    [
                        'user_id' => Auth::id(),
                        'tuya_room_id' => (string) $tuyaRoomId,
                    ],
                    [
                        'name' => (string) $tuyaRoomName,
                        'description' => $tuyaRoom['description'] ?? null,
                        'synced_at' => now(),
                    ]
                );
                
                // Synchroniser les équipements affectés à cette pièce
                try {
                    $this->syncRoomDevicesFromTuya($connection, $room);
                } catch (\Exception $e) {
                    Log::warning('Failed to sync devices for room', [
                        'room_id' => $room->id,
                        'tuya_room_id' => $room->tuya_room_id,
                        'error' => $e->getMessage(),
                    ]);
                }
                
                $synced[] = $this->transformRoom($room);
            }

            return response()->json([
                'message' => 'Synchronisation réussie: ' . count($synced) . ' pièce(s) importée(s).',
                'data' => $synced,
            ]);
        } catch (\Exception $e) {
            Log::warning('Tuya rooms sync failed', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Erreur lors de la synchronisation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupère les pièces depuis l'API Tuya Cloud
     */
    private function fetchTuyaRooms(TuyaConnection $connection): array
    {
        $paths = [
            "/v1.0/iot-03/homes/{$connection->home_id}/rooms",
            "/v1.0/homes/{$connection->home_id}/rooms",
            "/v1.0/iot-03/families/{$connection->home_id}/rooms",
            "/v1.0/families/{$connection->home_id}/rooms",
        ];

        foreach ($paths as $path) {
            $response = $this->tuyaSignedRequest($connection, 'GET', $path);
            $payload = $response->json() ?: [];

            if ($this->isTuyaSuccess($response, $payload)) {
                $result = $payload['result'] ?? [];

                if (!is_array($result)) {
                    return [];
                }

                if (array_is_list($result)) {
                    return $result;
                }

                foreach (['list', 'rooms', 'data'] as $key) {
                    if (isset($result[$key]) && is_array($result[$key])) {
                        return $result[$key];
                    }
                }

                if (isset($result['id']) || isset($result['room_id'])) {
                    return [$result];
                }

                return [];
            }
        }

        return [];
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
            'siteId' => 'nullable|integer',
            'requireTuyaSync' => 'nullable|boolean',
            'deviceIds' => 'nullable|array',
            'deviceIds.*' => 'string|max:120',
        ]);

        if (isset($validated['siteId']) && !$this->siteBelongsToUser((int) $validated['siteId'])) {
            return response()->json(['message' => 'Site invalide.'], 422);
        }

        $deviceIds = array_key_exists('deviceIds', $validated)
            ? $this->normalizeDeviceIds($validated['deviceIds'])
            : [];
        $requireTuyaSync = $validated['requireTuyaSync'] ?? true;

        $conflicts = $this->findConflictingDeviceAssignments($deviceIds);
        if (!empty($conflicts)) {
            return response()->json([
                'message' => $this->buildDeviceConflictMessage($conflicts),
                'conflicts' => $conflicts,
            ], 422);
        }

        $room = Room::create([
            'user_id' => Auth::id(),
            'site_id' => $validated['siteId'] ?? null,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'device_ids' => $deviceIds,
        ]);

        $syncWarning = $this->syncRoomToTuya($room, false);

        if ($requireTuyaSync && empty($room->tuya_room_id)) {
            $room->delete();

            return response()->json([
                'message' => $syncWarning ?: 'Impossible de creer la piece dans Tuya. Verifiez la connexion Tuya et Home ID.',
            ], 422);
        }

        return response()->json([
            'message' => $syncWarning ?: 'Piece creee avec succes.',
            'data' => $this->transformRoom($room),
        ], 201);
    }

    public function update(Request $request, Room $room)
    {
        if ($room->user_id !== Auth::id()) {
            return response()->json(['message' => 'Non autorise'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'description' => 'sometimes|nullable|string|max:500',
            'siteId' => 'sometimes|nullable|integer',
            'deviceIds' => 'sometimes|array',
            'deviceIds.*' => 'string|max:120',
        ]);

        if (array_key_exists('siteId', $validated)
            && !is_null($validated['siteId'])
            && !$this->siteBelongsToUser((int) $validated['siteId'])) {
            return response()->json(['message' => 'Site invalide.'], 422);
        }

        $normalizedDeviceIds = null;
        if (array_key_exists('deviceIds', $validated)) {
            $normalizedDeviceIds = $this->normalizeDeviceIds($validated['deviceIds']);
            $conflicts = $this->findConflictingDeviceAssignments($normalizedDeviceIds, $room->id);

            if (!empty($conflicts)) {
                return response()->json([
                    'message' => $this->buildDeviceConflictMessage($conflicts),
                    'conflicts' => $conflicts,
                ], 422);
            }
        }

        if (empty($validated)) {
            return response()->json(['message' => 'Aucune modification a appliquer.'], 422);
        }

        if (array_key_exists('name', $validated)) {
            $room->name = $validated['name'];
        }

        if (array_key_exists('description', $validated)) {
            $room->description = $validated['description'];
        }

        if (array_key_exists('siteId', $validated)) {
            $room->site_id = $validated['siteId'];
        }

        if (array_key_exists('deviceIds', $validated)) {
            $room->device_ids = $normalizedDeviceIds;
        }

        $room->save();

        $syncWarning = $this->syncRoomToTuya($room, true);

        return response()->json([
            'message' => $syncWarning ?: 'Piece mise a jour.',
            'data' => $this->transformRoom($room),
        ]);
    }

    public function destroy(Room $room)
    {
        if ($room->user_id !== Auth::id()) {
            return response()->json(['message' => 'Non autorise'], 403);
        }

        $syncWarning = $this->deleteRoomFromTuya($room);

        $room->delete();

        return response()->json([
            'message' => $syncWarning ?: 'Piece supprimee.',
        ]);
    }

    private function syncRoomToTuya(Room $room, bool $isUpdate): ?string
    {
        $connection = TuyaConnection::where('user_id', $room->user_id)->first();

        if (!$connection) {
            return null;
        }

        if (empty($connection->home_id)) {
            $room->last_sync_error = 'Synchronisation Tuya inactive: renseignez Home ID dans Parametres.';
            $room->synced_at = null;
            $room->save();

            return 'Piece enregistree localement. Ajoutez Home ID dans Parametres pour la synchroniser avec Tuya/Smart Life.';
        }

        try {
            if (empty($room->tuya_room_id)) {
                $tuyaRoomId = $this->createRemoteRoom($connection, $room);
                $room->tuya_room_id = $tuyaRoomId;
            } elseif ($isUpdate) {
                $this->updateRemoteRoom($connection, $room);
            }

            $deviceSyncWarning = null;
            if (!empty($room->tuya_room_id) && !empty($room->device_ids)) {
                $deviceSyncWarning = $this->syncRemoteRoomDevices($connection, $room);
            }

            $room->last_sync_error = null;
            $room->synced_at = now();
            $room->save();

            return $deviceSyncWarning ?: null;
        } catch (\Throwable $e) {
            if (str_contains((string) $e->getMessage(), 'TUYA_ROOM_API_UNSUPPORTED')) {
                $room->last_sync_error = null;
                $room->synced_at = null;
                $room->save();

                return 'Piece enregistree localement. L\'API Tuya de gestion des pieces n\'est pas disponible sur ce projet (code 1108 uri path invalid).';
            }

            Log::warning('Tuya room sync failed', [
                'room_id' => $room->id,
                'user_id' => $room->user_id,
                'tuya_room_id' => $room->tuya_room_id,
                'error' => $e->getMessage(),
            ]);

            $room->last_sync_error = 'Echec de synchronisation Tuya: ' . $e->getMessage();
            $room->synced_at = null;
            $room->save();

            return 'Piece enregistree localement, mais la synchro Tuya/Smart Life a echoue: ' . $e->getMessage();
        }
    }

    private function deleteRoomFromTuya(Room $room): ?string
    {
        if (empty($room->tuya_room_id)) {
            return null;
        }

        $connection = TuyaConnection::where('user_id', $room->user_id)->first();

        if (!$connection || empty($connection->home_id)) {
            return 'Piece supprimee localement. Suppression distante Tuya non executee (Home ID manquant).';
        }

        \Log::info("DELETE Tuya Room - Room ID: {$room->id}, Tuya Room ID: {$room->tuya_room_id}, Home ID: {$connection->home_id}");

        $deletePaths = [
            "/v1.0/homes/{$connection->home_id}/rooms/{$room->tuya_room_id}",
            "/v1.0/iot-03/homes/{$connection->home_id}/rooms/{$room->tuya_room_id}",
            "/v1.0/iot-03/families/{$connection->home_id}/rooms/{$room->tuya_room_id}",
            "/v1.0/families/{$connection->home_id}/rooms/{$room->tuya_room_id}",
        ];

        $errors = [];
        $codes = [];

        foreach ($deletePaths as $path) {
            \Log::info("Testing DELETE endpoint: {$path}");
            $response = $this->tuyaSignedRequestWithAutoRefresh($connection, 'DELETE', $path);
            $payload = $response->json() ?: [];

            \Log::info("DELETE response", [
                'status' => $response->status(),
                'code' => $payload['code'] ?? null,
                'success' => $payload['success'] ?? null,
                'payload' => $payload,
            ]);

            if ($this->isTuyaSuccess($response, $payload)) {
                \Log::info("DELETE SUCCESSFUL for path: {$path}");
                return null;
            }

            $errors[] = $this->formatTuyaError($path, $response, $payload);
            $codes[] = (int) ($payload['code'] ?? $response->status());
        }

        \Log::error("DELETE FAILED for all endpoints", ['codes' => $codes, 'errors' => $errors]);

        if (!empty($codes) && count(array_unique($codes)) === 1 && $codes[0] === 1108) {
            return 'Piece supprimee localement. L\'API Tuya de gestion des pieces n\'est pas disponible sur ce projet (code 1108 uri path invalid).';
        }

        return 'Piece supprimee localement, mais la suppression Tuya/Smart Life a echoue. ' . implode(' | ', $errors);
    }

    private function createRemoteRoom(TuyaConnection $connection, Room $room): string
    {
        $paths = [
            "/v1.0/homes/{$connection->home_id}/room",
            "/v1.0/iot-03/homes/{$connection->home_id}/rooms",
            "/v1.0/homes/{$connection->home_id}/rooms",
            "/v1.0/iot-03/families/{$connection->home_id}/rooms",
            "/v1.0/families/{$connection->home_id}/rooms",
        ];

        $errors = [];
        $codes = [];

        foreach ($paths as $path) {
            $response = $this->tuyaSignedRequestWithAutoRefresh($connection, 'POST', $path, [
                'name' => $room->name,
            ]);
            $payload = $response->json() ?: [];

            if ($this->isTuyaSuccess($response, $payload)) {
                $candidate = $this->extractTuyaRoomIdFromCreatePayload($payload);
                if (!is_null($candidate)) {
                    return $candidate;
                }

                $fallbackId = $this->resolveCreatedRoomIdFromListing($connection, $room->name);
                if (!is_null($fallbackId)) {
                    return $fallbackId;
                }

                throw new \RuntimeException('ID de piece Tuya non retourne.');
            }

            $errors[] = $this->formatTuyaError($path, $response, $payload);
            $codes[] = (int) ($payload['code'] ?? $response->status());
        }

        if (!empty($codes) && count(array_unique($codes)) === 1 && $codes[0] === 1108) {
            throw new \RuntimeException(
                'TUYA_ROOM_API_UNSUPPORTED: Les endpoints rooms ne sont pas exposes pour ce projet Tuya. '
                . implode(' | ', $errors)
            );
        }

        throw new \RuntimeException(
            'Impossible de creer la piece dans Tuya. Verifiez Home ID et les permissions Smart Home APIs. '
            . implode(' | ', $errors)
        );
    }

    private function extractTuyaRoomIdFromCreatePayload(array $payload): ?string
    {
        $result = $payload['result'] ?? null;

        if (is_scalar($result) && trim((string) $result) !== '') {
            return (string) $result;
        }

        if (!is_array($result)) {
            return null;
        }

        $candidates = [
            $result['id'] ?? null,
            $result['room_id'] ?? null,
            $result['roomId'] ?? null,
            $result['data']['id'] ?? null,
            $result['data']['room_id'] ?? null,
            $result['data']['roomId'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_scalar($candidate) && trim((string) $candidate) !== '') {
                return (string) $candidate;
            }
        }

        return null;
    }

    private function resolveCreatedRoomIdFromListing(TuyaConnection $connection, string $roomName): ?string
    {
        $rooms = $this->fetchTuyaRooms($connection);
        if (empty($rooms)) {
            return null;
        }

        foreach ($rooms as $tuyaRoom) {
            if (!is_array($tuyaRoom)) {
                continue;
            }

            $candidateName = $tuyaRoom['name'] ?? null;
            if (!is_scalar($candidateName)) {
                continue;
            }

            if (trim((string) $candidateName) !== trim($roomName)) {
                continue;
            }

            $candidateId = $tuyaRoom['id'] ?? $tuyaRoom['room_id'] ?? $tuyaRoom['roomId'] ?? null;
            if (is_scalar($candidateId) && trim((string) $candidateId) !== '') {
                return (string) $candidateId;
            }
        }

        return null;
    }

    private function updateRemoteRoom(TuyaConnection $connection, Room $room): void
    {
        $paths = [
            "/v1.0/homes/{$connection->home_id}/rooms/{$room->tuya_room_id}",
            "/v1.0/iot-03/homes/{$connection->home_id}/rooms/{$room->tuya_room_id}",
            "/v1.0/iot-03/families/{$connection->home_id}/rooms/{$room->tuya_room_id}",
            "/v1.0/families/{$connection->home_id}/rooms/{$room->tuya_room_id}",
        ];

        $errors = [];

        foreach ($paths as $path) {
            $response = $this->tuyaSignedRequestWithAutoRefresh($connection, 'PUT', $path, [
                'name' => $room->name,
            ]);
            $payload = $response->json() ?: [];

            if ($this->isTuyaSuccess($response, $payload)) {
                return;
            }

            $errors[] = $this->formatTuyaError($path, $response, $payload);
        }

        throw new \RuntimeException('Impossible de renommer la piece dans Tuya. ' . implode(' | ', $errors));
    }

    private function syncRemoteRoomDevices(TuyaConnection $connection, Room $room): ?string
    {
        $paths = [
            "/v1.0/iot-03/homes/{$connection->home_id}/rooms/{$room->tuya_room_id}/devices",
            "/v1.0/homes/{$connection->home_id}/rooms/{$room->tuya_room_id}/devices",
            "/v1.0/iot-03/families/{$connection->home_id}/rooms/{$room->tuya_room_id}/devices",
            "/v1.0/families/{$connection->home_id}/rooms/{$room->tuya_room_id}/devices",
        ];

        $body = [
            'device_ids' => $room->device_ids ?? [],
        ];

        $errors = [];
        $codes = [];

        foreach ($paths as $path) {
            $response = $this->tuyaSignedRequestWithAutoRefresh($connection, 'PUT', $path, $body);
            $payload = $response->json() ?: [];

            if ($this->isTuyaSuccess($response, $payload)) {
                return null;
            }

            $errors[] = $this->formatTuyaError($path, $response, $payload);
            $codes[] = (int) ($payload['code'] ?? $response->status());
        }

        if (!empty($codes) && count(array_unique($codes)) === 1 && $codes[0] === 1106) {
            return 'Equipements assigns localement. Les permissions Tuya ne permettent pas d\'affecter les equipements aux pieces. Vous pouvez les gerer directement dans l\'app Tuya.';
        }

        throw new \RuntimeException('Impossible d\'affecter les equipements a la piece dans Tuya. ' . implode(' | ', $errors));
    }

    /**
     * Récupère les équipements affectés à une pièce depuis Tuya et les sauvegarde localement
     */
    private function syncRoomDevicesFromTuya(TuyaConnection $connection, Room $room): void
    {
        // Si la pièce n'a pas de tuya_room_id, on ne peut pas récupérer ses équipements
        if (empty($room->tuya_room_id)) {
            return;
        }

        $paths = [
            "/v1.0/iot-03/homes/{$connection->home_id}/rooms/{$room->tuya_room_id}/devices",
            "/v1.0/homes/{$connection->home_id}/rooms/{$room->tuya_room_id}/devices",
            "/v1.0/iot-03/families/{$connection->home_id}/rooms/{$room->tuya_room_id}/devices",
            "/v1.0/families/{$connection->home_id}/rooms/{$room->tuya_room_id}/devices",
        ];

        foreach ($paths as $path) {
            $response = $this->tuyaSignedRequestWithAutoRefresh($connection, 'GET', $path);
            $payload = $response->json() ?: [];

            if ($this->isTuyaSuccess($response, $payload)) {
                $result = $payload['result'] ?? [];
                
                // Extraire les IDs des équipements
                $deviceIds = [];
                
                if (is_array($result)) {
                    if (array_is_list($result)) {
                        // Si c'est un tableau de devices
                        foreach ($result as $device) {
                            if (is_array($device) && isset($device['id'])) {
                                $deviceIds[] = (string) $device['id'];
                            }
                        }
                    } elseif (isset($result['list']) && is_array($result['list'])) {
                        // Si c'est un objet avec une clé 'list'
                        foreach ($result['list'] as $device) {
                            if (is_array($device) && isset($device['id'])) {
                                $deviceIds[] = (string) $device['id'];
                            }
                        }
                    }
                }
                
                // Sauvegarder les IDs des équipements
                $room->update(['device_ids' => $deviceIds]);
                return;
            }
        }

        Log::warning('Could not fetch devices from Tuya for room', [
            'room_id' => $room->id,
            'tuya_room_id' => $room->tuya_room_id,
            'home_id' => $connection->home_id,
        ]);
    }

    private function formatTuyaError(string $path, Response $response, array $payload): string
    {
        $code = $payload['code'] ?? $response->status();
        $msg = $payload['msg'] ?? 'unknown';

        return "{$path} => code {$code}, msg {$msg}";
    }

    private function tuyaSignedRequestWithAutoRefresh(
        TuyaConnection $connection,
        string $method,
        string $path,
        ?array $body = null
    ): Response {
        $response = $this->tuyaSignedRequest($connection, $method, $path, $body);
        $payload = $response->json() ?: [];

        if ($this->shouldRefreshTuyaToken($response, $payload)) {
            $newToken = $this->getTuyaToken(
                $connection->client_id,
                $connection->client_secret,
                $connection->region
            );

            $connection->update(['access_token' => $newToken]);
            $connection->refresh();

            return $this->tuyaSignedRequest($connection, $method, $path, $body);
        }

        return $response;
    }

    private function tuyaSignedRequest(
        TuyaConnection $connection,
        string $method,
        string $path,
        ?array $body = null
    ): Response {
        $baseUrl = $this->tuyaApiBase[$connection->region] ?? $this->tuyaApiBase['eu'];
        $timestamp = (string) round(microtime(true) * 1000);
        $nonce = bin2hex(random_bytes(8));
        $method = strtoupper($method);
        $jsonBody = $body ? json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';
        
        // Pour DELETE, le corps doit être vide (pas '{}') pour que la signature soit valide
        $bodyToSend = ($method === 'DELETE') ? '' : ($jsonBody ?: '{}');
        $contentHash = hash('sha256', $bodyToSend);
        $stringToSign = "{$method}\n{$contentHash}\n\n{$path}";
        $signPayload = $connection->client_id . $connection->access_token . $timestamp . $nonce . $stringToSign;
        $sign = strtoupper(hash_hmac('sha256', $signPayload, $connection->client_secret));

        $request = Http::withoutVerifying()
            ->acceptJson()
            ->withHeaders([
                'client_id' => $connection->client_id,
                'access_token' => $connection->access_token,
                'sign' => $sign,
                't' => $timestamp,
                'nonce' => $nonce,
                'sign_method' => 'HMAC-SHA256',
                'Content-Type' => 'application/json',
            ]);

        if ($method === 'GET') {
            return $request->get("{$baseUrl}{$path}");
        }

        if ($method === 'POST') {
            return $request->withBody($jsonBody ?: '{}', 'application/json')->post("{$baseUrl}{$path}");
        }

        if ($method === 'PUT') {
            return $request->withBody($jsonBody ?: '{}', 'application/json')->put("{$baseUrl}{$path}");
        }

        if ($method === 'DELETE') {
            return $request->delete("{$baseUrl}{$path}");
        }

        throw new \InvalidArgumentException('Methode HTTP Tuya non supportee: ' . $method);
    }

    private function isTuyaSuccess(Response $response, array $payload): bool
    {
        if (!$response->successful()) {
            return false;
        }

        if (array_key_exists('success', $payload)) {
            return $payload['success'] !== false;
        }

        return true;
    }

    private function shouldRefreshTuyaToken(Response $response, array $payload): bool
    {
        if ($response->status() === 401) {
            return true;
        }

        if (!isset($payload['code'])) {
            return false;
        }

        return in_array((int) $payload['code'], [1010, 1011], true);
    }

    private function getTuyaToken(string $clientId, string $clientSecret, string $region): string
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

        $data = $response->json() ?: [];

        if (!$response->successful() || (isset($data['success']) && $data['success'] === false)) {
            throw new \RuntimeException($data['msg'] ?? 'Token Tuya invalide');
        }

        if (!isset($data['result']['access_token'])) {
            throw new \RuntimeException('Token Tuya non recu');
        }

        return $data['result']['access_token'];
    }

    private function transformRoom(Room $room): array
    {
        $room->loadMissing('site');

        return [
            'id' => $room->id,
            'siteId' => $room->site_id,
            'siteName' => $room->site?->name,
            'name' => $room->name,
            'description' => $room->description,
            'deviceIds' => $room->device_ids ?? [],
            'devicesCount' => count($room->device_ids ?? []),
            'tuyaRoomId' => $room->tuya_room_id,
            'syncStatus' => $room->last_sync_error ? 'warning' : ($room->tuya_room_id ? 'synced' : 'local'),
            'syncMessage' => $room->last_sync_error,
            'syncedAt' => $room->synced_at,
            'createdAt' => $room->created_at,
        ];
    }

    private function transformSite(Site $site): array
    {
        return [
            'id' => $site->id,
            'name' => $site->name,
            'address' => $site->address,
            'createdAt' => $site->created_at,
        ];
    }

    private function siteBelongsToUser(int $siteId): bool
    {
        return Site::where('id', $siteId)
            ->where('user_id', Auth::id())
            ->exists();
    }

    private function normalizeDeviceIds(array $deviceIds): array
    {
        return array_values(array_unique(array_filter(array_map(
            static fn ($id) => is_scalar($id) ? trim((string) $id) : '',
            $deviceIds
        ))));
    }

    private function findConflictingDeviceAssignments(array $deviceIds, ?int $excludeRoomId = null): array
    {
        if (empty($deviceIds)) {
            return [];
        }

        $roomsQuery = Room::where('user_id', Auth::id())
            ->select(['id', 'name', 'device_ids']);

        if (!is_null($excludeRoomId)) {
            $roomsQuery->where('id', '!=', $excludeRoomId);
        }

        $rooms = $roomsQuery->get();
        $targetIds = array_flip($deviceIds);
        $conflicts = [];

        foreach ($rooms as $existingRoom) {
            $existingDeviceIds = is_array($existingRoom->device_ids)
                ? $this->normalizeDeviceIds($existingRoom->device_ids)
                : [];

            foreach ($existingDeviceIds as $existingDeviceId) {
                if (!isset($targetIds[$existingDeviceId])) {
                    continue;
                }

                $conflicts[] = [
                    'deviceId' => $existingDeviceId,
                    'roomId' => $existingRoom->id,
                    'roomName' => $existingRoom->name,
                ];
            }
        }

        return $conflicts;
    }

    private function buildDeviceConflictMessage(array $conflicts): string
    {
        $devices = implode(', ', array_values(array_unique(array_column($conflicts, 'deviceId'))));

        return 'Impossible d\'associer ces equipements a cette zone: deja utilises dans une autre zone (' . $devices . ').';
    }
}
