<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BeetrackService
{
    protected $apiKey;
    protected $baseUrl;

    public function __construct()
    {
        $this->apiKey = config('services.beetrack.api_key');
        $this->baseUrl = config('services.beetrack.url');
    }

    public function getDispatchStatus()
    {
        Log::info('BeetrackService: Starting getDispatchStatus');

        return \Illuminate\Support\Facades\Cache::remember('beetrack_status_v4', 60, function () {
            $today = now()->format('d-m-Y');
            Log::info("BeetrackService: Fetching for date: {$today} (Fresh Cache)");

            try {
                $response = Http::timeout(20)->withHeaders([
                    'X-AUTH-TOKEN' => $this->apiKey,
                ])->get($this->baseUrl, ['date' => $today]);

                if (!$response->successful()) {
                    Log::error("Beetrack API Error: " . $response->body());
                    return ['status' => 'error', 'message' => 'API Error'];
                }

                $rutasRaw = $response->json()['response']['routes'] ?? [];
                Log::info('Beetrack Raw Routes Count: ' . count($rutasRaw));

                $activeRoutes = [];
                foreach ($rutasRaw as $r) {
                    $idRuta = $r['id'] ?? null;
                    if ($idRuta && ($r['started_at'] ?? null) !== null && ($r['ended_at'] ?? null) === null) {
                        $activeRoutes[] = $r;
                    }
                }

                // Concurrent fetching for active route details
                $activeDetails = [];
                if (!empty($activeRoutes)) {
                    $responses = Http::pool(
                        fn($pool) =>
                        collect($activeRoutes)->map(
                            fn($r) =>
                            $pool->as($r['id'])->timeout(10)->withHeaders(['X-AUTH-TOKEN' => $this->apiKey])->get("{$this->baseUrl}/{$r['id']}")
                        )
                    );

                    foreach ($responses as $id => $resp) {
                        if ($resp->successful()) {
                            $activeDetails[$id] = $resp->json()['response'] ?? [];
                        }
                    }
                }

                $estadoMensajeros = [];
                foreach ($rutasRaw as $r) {
                    $nombre = $r['driver_name'] ?? $r['driver_identifier'] ?? 'Sin Nombre';
                    $idRuta = $r['id'] ?? null;
                    $esActivo = isset($activeDetails[$idRuta]);

                    $gestionadas = 0;
                    $total = 0;
                    $successful = 0;
                    $failed = 0;

                    if ($esActivo) {
                        $details = $activeDetails[$idRuta]['route'] ?? $activeDetails[$idRuta] ?? null;
                        if ($details) {
                            $despachos = $details['dispatches'] ?? [];
                            $total = count($despachos);
                            $gestionadas = collect($despachos)->filter(fn($d) => in_array($d['status'] ?? '', ['completed', 'failed', 'partial', 'delivered']))->count();
                            $successful = collect($despachos)->filter(fn($d) => in_array($d['status'] ?? '', ['completed', 'delivered']))->count();
                            $failed = $total - $successful;
                        }
                    } else {
                        // For finished routes, we might get some info from the raw route object
                        $total = $r['dispatches_count'] ?? 0;
                        $gestionadas = $r['dispatches_count'] ?? 0;
                    }

                    $porcentaje = ($total > 0) ? round(($gestionadas / $total) * 100) : 0;

                    $estadoMensajeros[$nombre] = [
                        'nombre' => $nombre,
                        'unidad' => $r['truck']['identifier'] ?? 'S/U',
                        'activo' => $esActivo,
                        'hora_cierre' => ($r['ended_at'] ?? null) ? substr($r['ended_at'], 11, 5) : '',
                        'progreso_str' => "{$gestionadas}/{$total}",
                        'porcentaje' => $porcentaje,
                        'lat' => $this->getPosition($r, 'lat'),
                        'lng' => $this->getPosition($r, 'lng'),
                        'metrics' => [
                            'total' => $total,
                            'completed' => $gestionadas,
                            'successful' => $successful,
                            'failed' => $failed,
                            'routes_count' => 1
                        ]
                    ];
                }

                return [
                    'status' => 'success',
                    'activos' => collect($estadoMensajeros)->where('activo', true)->values(),
                    'libres' => collect($estadoMensajeros)->where('activo', false)->values(),
                ];

            } catch (\Exception $e) {
                Log::error("Beetrack Service Exception: " . $e->getMessage());
                return ['status' => 'error', 'message' => $e->getMessage()];
            }
        });
    }

    public function createDispatch(array $data)
    {
        try {
            // Beetrack API endpoint for creating dispatches
            // Note: This is a placeholder - actual endpoint may vary
            $createUrl = str_replace('/routes', '/dispatches', $this->baseUrl);

            $payload = [
                'identifier' => $data['guide'],
                'contact_name' => $data['contact_name'],
                'contact' => $data['contact_name'],
                'contact_phone' => $data['contact_phone'] ?: '0',
                'phone' => $data['contact_phone'] ?: '0',
                'contact_email' => $data['contact_email'] ?? '',
                'email' => $data['contact_email'] ?? '',
                'contact_identifier' => $data['contact_identifier'] ?? '',
                'contact_id' => $data['contact_identifier'] ?? '',
                'vat_number' => $data['contact_identifier'] ?? '',
                'address' => ($data['address'] ?? '') . ', ' . ($data['city'] ?? 'BOGOTA') . ', Colombia',
                'contact_address' => ($data['address'] ?? '') . ', ' . ($data['city'] ?? 'BOGOTA') . ', Colombia',
                'city' => $data['city'] ?? 'BOGOTA',
                'lat' => $data['latitude'] ?? '',
                'lng' => $data['longitude'] ?? '',
                'latitude' => $data['latitude'] ?? '',
                'longitude' => $data['longitude'] ?? '',
                'min_delivery_time' => $data['min_delivery_at'] ? date('Y-m-d H:i:s', strtotime($data['min_delivery_at'])) : '',
                'max_delivery_time' => $data['max_delivery_at'] ? date('Y-m-d H:i:s', strtotime($data['max_delivery_at'])) : '',
                'notes' => $data['description'] ?? '',
                'description' => $data['description'] ?? '',

                // --- CUSTOM FIELDS SHOTGUN ---

                // 1. Standard Beetrack fields array (try multiple casings)
                'fields' => [
                    ['name' => 'Prioridad', 'value' => $data['priority'] ?? 'Normal'],
                    ['name' => 'INFO', 'value' => $data['observations'] ?? ''],
                    ['name' => 'prioridad', 'value' => $data['priority'] ?? 'Normal'],
                    ['name' => 'info', 'value' => $data['observations'] ?? ''],
                    ['name' => 'PRIORIDAD', 'value' => $data['priority'] ?? 'Normal'],
                ],

                // 2. custom_fields array variant
                'custom_fields' => [
                    ['name' => 'Prioridad', 'value' => $data['priority'] ?? 'Normal'],
                    ['name' => 'INFO', 'value' => $data['observations'] ?? ''],
                ],

                // 3. custom_attributes object variant (Case sensitive matching is common here)
                'custom_attributes' => [
                    'Prioridad' => $data['priority'] ?? 'Normal',
                    'INFO' => $data['observations'] ?? '',
                    'prioridad' => $data['priority'] ?? 'Normal',
                    'info' => $data['observations'] ?? '',
                ],

                // 4. Root level attributes (fallback for some v1 endpoints)
                'Prioridad' => $data['priority'] ?? 'Normal',
                'INFO' => $data['observations'] ?? '',
                'prioridad' => $data['priority'] ?? 'Normal',
                'info' => $data['observations'] ?? '',

                'items' => [
                    [
                        'name' => $data['item_name'] ?? 'RECOGER',
                        'quantity' => $data['item_quantity'] ?? 1,
                        'code' => $data['item_code'] ?? '',
                        // 5. Item Extras variant
                        'extras' => [
                            ['name' => 'Prioridad', 'value' => $data['priority'] ?? 'Normal'],
                            ['name' => 'INFO', 'value' => $data['observations'] ?? ''],
                            ['name' => 'prioridad', 'value' => $data['priority'] ?? 'Normal'],
                            ['name' => 'info', 'value' => $data['observations'] ?? ''],
                        ]
                    ]
                ],
                'date' => now()->format('Y-m-d'),
            ];

            // Forced logging to the main log file
            Log::channel('single')->info('BEETRACK ATTEMPT - GUID: ' . $data['guide'], ['payload' => $payload]);

            $response = Http::timeout(45)->withHeaders([
                'X-AUTH-TOKEN' => $this->apiKey,
                'Content-Type' => 'application/json',
            ])->post($createUrl, $payload);

            Log::info('BeetrackService: createDispatch response', [
                'status' => $response->status(),
                'body' => $response->json() ?: $response->body(),
            ]);

            if ($response->successful()) {
                $result = $response->json();
                Log::info('BeetrackService: Dispatch created successfully', $result);

                return [
                    'success' => true,
                    'dispatch_id' => $result['response']['id'] ?? null,
                    'data' => $result
                ];
            } else {
                Log::error('BeetrackService: Failed to create dispatch', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);

                return [
                    'success' => false,
                    'message' => 'Error en la API de Beetrack: ' . $response->status()
                ];
            }
        } catch (\Exception $e) {
            Log::error('BeetrackService: Exception creating dispatch', [
                'message' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    public function clearCache()
    {
        \Illuminate\Support\Facades\Cache::forget('beetrack_status_v4');
        \Illuminate\Support\Facades\Log::info('BeetrackService: Cache cleared manually');
    }

    /**
     * Helper to extract coordinates from multiple potential Beetrack fields
     */
    private function getPosition($data, $type)
    {
        $keys = $type === 'lat'
            ? ['latitude', 'lat', 'latitude_last', 'last_latitude']
            : ['longitude', 'lng', 'longitude_last', 'last_longitude'];

        // 1. Check root level
        foreach ($keys as $key) {
            if (!empty($data[$key]))
                return $data[$key];
        }

        // 2. Check truck object if exists
        if (isset($data['truck'])) {
            foreach ($keys as $key) {
                if (!empty($data['truck'][$key]))
                    return $data['truck'][$key];
            }
        }

        // 3. Check inside dispatches (last one usually has the vehicle position if updated)
        if (isset($data['dispatches']) && is_array($data['dispatches'])) {
            foreach (array_reverse($data['dispatches']) as $dispatch) {
                foreach ($keys as $key) {
                    if (!empty($dispatch[$key]))
                        return $dispatch[$key];
                }
            }
        }

        return null;
    }
}
