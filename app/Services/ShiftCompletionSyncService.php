<?php

namespace App\Services;

use App\Models\Messenger;
use App\Models\ShiftCompletion;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Registra el fin de turno de cada mensajero con la hora de la última guía
 * gestionada en su última ruta de DispatchTrack.
 */
class ShiftCompletionSyncService
{
    // Campos de hora de gestión que puede traer un despacho, por orden de preferencia
    private const DISPATCH_TIME_FIELDS = ['arrived_at', 'delivered_at', 'finished_at', 'managed_at'];

    private const MANAGED_STATUSES = ['completed', 'delivered', 'failed', 'partial'];

    protected $apiKey;
    protected $baseUrl;

    public function __construct()
    {
        $this->apiKey = config('services.beetrack.api_key');
        $this->baseUrl = config('services.beetrack.url');
    }

    /**
     * @param bool $dryRun Calcula sin guardar.
     * @return array{date: string, created: int, updated: int, unchanged: int, results: array}
     */
    public function sync(Carbon $date, ?int $messengerId = null, bool $dryRun = false): array
    {
        $routes = $this->fetchRoutes($date);

        // Un día ya terminado cuenta también rutas que el mensajero no cerró en la app
        $includeOpenRoutes = $date->copy()->startOfDay()->lt(today());

        $messengers = Messenger::where('is_active', true)
            ->when($messengerId, fn($q) => $q->where('id', $messengerId))
            ->get();

        // Última ruta iniciada por cada mensajero
        $lastRoutes = [];
        foreach ($messengers as $messenger) {
            $route = collect($routes)
                ->filter(fn($r) => !empty($r['started_at']) && $this->routeBelongsTo($r, $messenger))
                ->sortByDesc(fn($r) => Carbon::parse($r['started_at'])->timestamp)
                ->first();

            if ($route) {
                $lastRoutes[$messenger->id] = $route;
            }
        }

        $details = $this->fetchRouteDetails(collect($lastRoutes)->pluck('id')->filter()->unique()->all());

        $summary = ['date' => $date->toDateString(), 'created' => 0, 'updated' => 0, 'unchanged' => 0, 'results' => []];

        foreach ($messengers as $messenger) {
            $route = $lastRoutes[$messenger->id] ?? null;

            if (!$route) {
                continue; // Sin rutas ese día: no se registra nada
            }

            if (empty($route['ended_at']) && !$includeOpenRoutes) {
                $summary['results'][] = $this->result($messenger, 'skipped', 'Última ruta aún en curso');
                continue;
            }

            $lastGuide = $this->lastManagedGuide($details[$route['id']] ?? [], $route);

            if (!$lastGuide) {
                $summary['results'][] = $this->result($messenger, 'skipped', 'Última ruta sin guías gestionadas');
                continue;
            }

            $finishedAt = $lastGuide['time'];
            $notes = "DispatchTrack: ruta {$route['id']}" . ($lastGuide['identifier'] ? ", guía {$lastGuide['identifier']}" : '');

            // La última guía puede caer pasada la medianoche: también se busca por la ruta
            $completion = ShiftCompletion::where('messenger_id', $messenger->id)
                ->where(fn($q) => $q->whereDate('finished_at', $date->toDateString())
                    ->orWhere('notes', 'like', "DispatchTrack: ruta {$route['id']}%"))
                ->first();

            if ($completion && $completion->finished_at->equalTo($finishedAt) && $completion->notes === $notes) {
                $summary['unchanged']++;
                $summary['results'][] = $this->result($messenger, 'unchanged', $notes, $finishedAt);
                continue;
            }

            $status = $completion ? 'updated' : 'created';

            if (!$dryRun) {
                $data = ['messenger_id' => $messenger->id, 'finished_at' => $finishedAt, 'notes' => $notes];
                $completion ? $completion->update($data) : ShiftCompletion::create($data);
            }

            $summary[$status]++;
            $summary['results'][] = $this->result($messenger, $status, $notes, $finishedAt);
        }

        return $summary;
    }

    /**
     * Despacho completo de la última ruta de la fecha, para inspeccionar los campos que trae la API.
     */
    public function sampleDispatch(Carbon $date): ?array
    {
        $route = collect($this->fetchRoutes($date))
            ->filter(fn($r) => !empty($r['started_at']))
            ->sortByDesc(fn($r) => Carbon::parse($r['started_at'])->timestamp)
            ->first();

        if (!$route) {
            return null;
        }

        $dispatches = $this->dispatchesOf($this->fetchRouteDetails([$route['id']])[$route['id']] ?? []);

        return end($dispatches) ?: null;
    }

    private function fetchRoutes(Carbon $date): array
    {
        $response = Http::timeout(20)
            ->withHeaders(['X-AUTH-TOKEN' => $this->apiKey])
            ->get($this->baseUrl, ['date' => $date->format('d-m-Y')]);

        if (!$response->successful()) {
            Log::error('ShiftCompletionSync: error consultando rutas', ['status' => $response->status(), 'body' => $response->body()]);
            throw new \RuntimeException('DispatchTrack respondió con error ' . $response->status());
        }

        return $response->json()['response']['routes'] ?? [];
    }

    private function fetchRouteDetails(array $routeIds): array
    {
        if (empty($routeIds)) {
            return [];
        }

        $responses = Http::pool(
            fn($pool) => collect($routeIds)->map(
                fn($id) => $pool->as((string) $id)->timeout(15)->withHeaders(['X-AUTH-TOKEN' => $this->apiKey])->get("{$this->baseUrl}/{$id}")
            )
        );

        $details = [];
        foreach ($responses as $id => $resp) {
            if ($resp instanceof \Illuminate\Http\Client\Response && $resp->successful()) {
                $details[$id] = $resp->json()['response'] ?? [];
            } else {
                Log::warning("ShiftCompletionSync: no se pudo obtener el detalle de la ruta {$id}");
            }
        }

        return $details;
    }

    private function routeBelongsTo(array $route, Messenger $messenger): bool
    {
        if ($messenger->beetrack_id) {
            $driverIds = array_filter([$route['driver_identifier'] ?? null, $route['driver_id'] ?? null]);
            if (in_array(strtolower(trim($messenger->beetrack_id)), array_map(fn($id) => strtolower(trim((string) $id)), $driverIds), true)) {
                return true;
            }
        }

        $plate = $this->normalizePlate($route['truck']['identifier'] ?? ($route['truck_identifier'] ?? ''));

        return $plate !== '' && $plate === $this->normalizePlate($messenger->vehicle ?? '');
    }

    private function normalizePlate(string $plate): string
    {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $plate));
    }

    private function dispatchesOf(array $detail): array
    {
        $route = $detail['route'] ?? $detail;

        return $route['dispatches'] ?? [];
    }

    /**
     * Guía gestionada más tarde en la ruta. Si los despachos no traen hora, usa el cierre de la ruta.
     */
    private function lastManagedGuide(array $detail, array $route): ?array
    {
        $last = null;

        foreach ($this->dispatchesOf($detail) as $dispatch) {
            if (!in_array($dispatch['status'] ?? '', self::MANAGED_STATUSES, true)) {
                continue;
            }

            $time = $this->dispatchTime($dispatch);
            if ($time && (!$last || $time->gt($last['time']))) {
                $last = ['time' => $time, 'identifier' => $dispatch['identifier'] ?? null];
            }
        }

        if (!$last && !empty($route['ended_at'])) {
            $last = ['time' => $this->toLocal($route['ended_at']), 'identifier' => null];
        }

        return $last;
    }

    private function dispatchTime(array $dispatch): ?Carbon
    {
        foreach (self::DISPATCH_TIME_FIELDS as $field) {
            if (!empty($dispatch[$field])) {
                return $this->toLocal($dispatch[$field]);
            }
        }

        return null;
    }

    private function toLocal(string $value): Carbon
    {
        return Carbon::parse($value)->setTimezone(config('app.timezone'));
    }

    private function result(Messenger $messenger, string $status, string $detail, ?Carbon $time = null): array
    {
        return [
            'messenger' => $messenger->name,
            'status' => $status,
            'finished_at' => $time?->format('Y-m-d H:i'),
            'detail' => $detail,
        ];
    }
}
