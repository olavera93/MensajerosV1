<?php

namespace App\Traits;

use App\Models\Messenger;
use Carbon\Carbon;

/**
 * Reglas compartidas para interpretar las rutas y guías de DispatchTrack.
 */
trait ReadsDispatchTrackRoutes
{
    // Estados de una guía ya gestionada por el mensajero (la API usa los tres primeros; los demás por compatibilidad)
    protected static array $managedStatuses = ['delivered', 'not_delivered', 'partially_delivered', 'completed', 'failed', 'partial'];

    protected function routeBelongsTo(array $route, Messenger $messenger): bool
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

    protected function normalizePlate(string $plate): string
    {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $plate));
    }

    protected function isManaged(array $dispatch): bool
    {
        return in_array($dispatch['status'] ?? '', self::$managedStatuses, true);
    }

    // Guías WH (Principal) y TE (Teusaquillo): regreso del mensajero a la bodega
    protected function isReturnGuide(array $dispatch): bool
    {
        return (bool) preg_match('/^(WH|TE)\d/i', $dispatch['identifier'] ?? '');
    }

    protected function toLocal(string $value): Carbon
    {
        return Carbon::parse($value)->setTimezone(config('app.timezone'));
    }
}
