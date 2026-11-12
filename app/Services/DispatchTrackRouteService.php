<?php

namespace App\Services;

use App\Models\DispatchLog;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Crea rutas en DispatchTrack subiendo el mismo rutero que hoy se importa a mano
 * (POST /api/external/v1/import). La importación es asíncrona: la ruta se confirma
 * después buscándola en las rutas del día.
 */
class DispatchTrackRouteService
{
    /** Minutos de espera antes de dar por no encontrada una ruta enviada. */
    public const CONFIRM_MINUTES = 5;

    public function __construct(private BeetrackService $beetrack)
    {
    }

    public function enabled(): bool
    {
        return (bool) config('services.beetrack.create_routes') && config('services.beetrack.api_key');
    }

    /**
     * Sube el rutero a la importación de DispatchTrack. Lanza DispatchTrackException si no queda en cola.
     */
    public function import(string $xlsx, string $filename, Carbon $date): void
    {
        $url = preg_replace('#/routes/?$#', '/import', rtrim(config('services.beetrack.url'), '/'));

        try {
            $response = Http::timeout(30)
                ->withHeaders(['X-AUTH-TOKEN' => config('services.beetrack.api_key')])
                ->acceptJson()
                ->attach('file', $xlsx, $filename)
                ->post($url, ['date' => $date->format('d-m-Y')]);
        } catch (ConnectionException $e) {
            Log::warning('DispatchTrack sin respuesta al importar: ' . $e->getMessage());
            throw new DispatchTrackException('DispatchTrack no responde. Intenta de nuevo o descarga el Excel.');
        }

        $body = $response->json() ?? [];
        if (!$response->successful() || ($body['status'] ?? null) !== 'ok') {
            $detail = is_string($body['response'] ?? null) ? $body['response'] : 'HTTP ' . $response->status();
            Log::warning('DispatchTrack rechazó la importación: ' . $detail);
            throw new DispatchTrackException('DispatchTrack rechazó la ruta: ' . $detail . '.');
        }
    }

    /**
     * Guías del rutero que ya están en alguna ruta de hoy en DispatchTrack.
     *
     * @return array<string> guías repetidas; null si no se pudo consultar
     */
    public function guidesAlreadyRouted(array $guides): ?array
    {
        try {
            $routed = collect($this->beetrack->getTodayRoutes())
                ->flatMap(fn($r) => collect($r['dispatches'] ?? [])->pluck('identifier'))
                ->map(fn($id) => (string) $id)
                ->all();
        } catch (\Throwable $e) {
            Log::warning('No se pudieron consultar las rutas de hoy: ' . $e->getMessage());
            return null;
        }

        return array_values(array_intersect($guides, $routed));
    }

    /**
     * Busca en las rutas de hoy la ruta enviada: mismo vehículo y al menos una de sus guías.
     * Actualiza el registro cuando la encuentra o cuando se agota la espera.
     */
    public function confirm(DispatchLog $log): DispatchLog
    {
        if ($log->dt_status !== 'queued') {
            return $log;
        }

        $normalize = fn($s) => preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $s));
        $guides = array_map('strval', $log->dt_guides ?? []);

        try {
            $route = collect($this->beetrack->getTodayRoutes())->first(function ($r) use ($log, $normalize, $guides) {
                $sameTruck = $normalize($r['truck']['identifier'] ?? $r['truck_identifier'] ?? '') === $normalize($log->dt_truck);
                $ids = collect($r['dispatches'] ?? [])->pluck('identifier')->map(fn($id) => (string) $id)->all();
                return $sameTruck && array_intersect($guides, $ids);
            });
        } catch (\Throwable $e) {
            return $log; // se reintenta en la siguiente consulta
        }

        if ($route) {
            $log->update(['dt_status' => 'created', 'dt_route_id' => (string) ($route['id'] ?? '')]);
        } elseif ($log->dt_sent_at && $log->dt_sent_at->diffInMinutes(now()) >= self::CONFIRM_MINUTES) {
            $log->update(['dt_status' => 'not_found']);
        }

        return $log;
    }
}
