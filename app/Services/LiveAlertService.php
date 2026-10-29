<?php

namespace App\Services;

use App\Models\Messenger;
use Carbon\Carbon;

/**
 * Alertas en vivo del dashboard a partir de la última ruta de cada mensajero en DispatchTrack:
 * - idle: ruta abierta con guías pendientes y sin gestionar ninguna desde hace rato.
 * - return: todas las guías gestionadas y la guía de retorno (WH/TE) sin marcar.
 * También calcula desde cuándo está disponible (sin ruta) cada mensajero.
 */
class LiveAlertService
{
    use \App\Traits\ReadsDispatchTrackRoutes;

    public function __construct(protected BeetrackService $beetrack)
    {
    }

    public function alerts(?Carbon $now = null): array
    {
        $now = $now ?? now();
        $limits = config('services.beetrack.alerts');
        $routes = $this->startedRoutes();

        $alerts = [];
        foreach ($this->workingMessengers() as $messenger) {
            $route = $this->latestRoute($routes, $messenger);

            if (!$route || !empty($route['ended_at'])) {
                continue;
            }

            $alert = $this->routeAlert($route, $now, $limits);
            if (!$alert) {
                continue;
            }

            // En almuerzo no se considera inactivo
            $onLunch = $messenger->lunchLogs->contains(fn($log) => $now->between($log->start_time, $log->end_time));
            if ($onLunch && $alert['type'] === 'idle') {
                continue;
            }

            $alerts[] = $alert + [
                'messenger_id' => $messenger->id,
                'name' => $messenger->name,
                'location' => strtolower($messenger->shifts->first()->location ?? 'principal'),
            ];
        }

        return collect($alerts)->sortByDesc(fn($a) => $a['minutes'] / $a['threshold'])->values()->all();
    }

    /**
     * Desde cuándo cada mensajero está sin ruta: lo más reciente entre el cierre de su última ruta,
     * el fin de su almuerzo y el inicio de su turno. Se omiten los que están en ruta o almorzando.
     *
     * @return array<int, array{since: string, reason: string}>
     */
    public function availableSince(?Carbon $now = null): array
    {
        $now = $now ?? now();
        $routes = $this->startedRoutes();

        $result = [];
        foreach ($this->workingMessengers() as $messenger) {
            $route = $this->latestRoute($routes, $messenger);
            if ($route && empty($route['ended_at'])) {
                continue;
            }
            if ($messenger->lunchLogs->contains(fn($log) => $now->between($log->start_time, $log->end_time))) {
                continue;
            }

            $shift = $messenger->shifts->first();
            $candidates = collect([
                'shift' => $shift && $shift->start_time ? Carbon::parse($shift->date)->setTimeFromTimeString($shift->start_time) : null,
                'route' => $route ? $this->toLocal($route['ended_at']) : null,
                'lunch' => $messenger->lunchLogs->map(fn($log) => $log->end_time)->filter(fn($t) => $t->lte($now))->max(),
            ])->filter(fn($t) => $t && $t->lte($now));

            if ($candidates->isEmpty()) {
                continue;
            }

            $reason = $candidates->sortByDesc(fn($t) => $t->timestamp)->keys()->first();
            $result[$messenger->id] = ['since' => $candidates[$reason]->toIso8601String(), 'reason' => $reason];
        }

        return $result;
    }

    /**
     * Inicio y última guía gestionada de la ruta abierta de cada mensajero.
     *
     * @return array<int, array{started_at: string, last_at: ?string}>
     */
    public function routeActivity(): array
    {
        $routes = $this->startedRoutes();

        $result = [];
        foreach ($this->workingMessengers() as $messenger) {
            $route = $this->latestRoute($routes, $messenger);
            if (!$route || !empty($route['ended_at'])) {
                continue;
            }

            $last = collect($route['dispatches'] ?? [])
                ->filter(fn($d) => !$this->isReturnGuide($d) && $this->isManaged($d) && !empty($d['arrived_at']))
                ->map(fn($d) => $this->toLocal($d['arrived_at']))
                ->max();

            $result[$messenger->id] = [
                'started_at' => $this->toLocal($route['started_at'])->toIso8601String(),
                'last_at' => $last?->toIso8601String(),
            ];
        }

        return $result;
    }

    private function startedRoutes()
    {
        return collect($this->beetrack->getTodayRoutes())->filter(fn($r) => !empty($r['started_at']));
    }

    // Mensajeros activos de DispatchTrack con turno hoy (no ausentes) que no han finalizado
    private function workingMessengers()
    {
        return Messenger::where('is_active', true)
            ->inDispatchTrack()
            ->with([
                'shifts' => fn($q) => $q->whereDate('date', today()),
                'lunchLogs' => fn($q) => $q->where('status', 'active')->whereDate('start_time', today()),
                'shiftCompletions' => fn($q) => $q->whereDate('finished_at', today()),
            ])->get()
            ->filter(fn($m) => $m->shiftCompletions->isEmpty() && $m->shifts->first() && $m->shifts->first()->status !== 'absent');
    }

    // Solo cuenta la ruta más reciente: las anteriores ya quedaron atrás aunque tengan pendientes
    private function latestRoute($routes, Messenger $messenger): ?array
    {
        return $routes->filter(fn($r) => $this->routeBelongsTo($r, $messenger))
            ->sortByDesc(fn($r) => $this->toLocal($r['started_at'])->timestamp)
            ->first();
    }

    private function routeAlert(array $route, Carbon $now, array $limits): ?array
    {
        $dispatches = collect($route['dispatches'] ?? []);
        $returnGuide = $dispatches->first(fn($d) => $this->isReturnGuide($d));
        $clients = $dispatches->reject(fn($d) => $this->isReturnGuide($d));
        $managed = $clients->filter(fn($d) => $this->isManaged($d) && !empty($d['arrived_at']));
        $last = $managed->map(fn($d) => $this->toLocal($d['arrived_at']))->max();
        $pending = $clients->count() - $managed->count();
        $progress = $managed->count() . '/' . $clients->count();

        if ($pending > 0) {
            // Sin guías gestionadas se mide desde el inicio de la ruta, con más margen para llegar a la primera
            $since = $last ?? $this->toLocal($route['started_at']);
            $threshold = $last ? $limits['idle_minutes'] : $limits['first_guide_minutes'];
            $minutes = (int) $since->diffInMinutes($now);

            return $minutes >= $threshold ? [
                'type' => 'idle',
                'minutes' => $minutes,
                'threshold' => $threshold,
                'since' => $since->format('h:i A'),
                'progress' => $progress,
                'first_guide' => !$last,
            ] : null;
        }

        if ($returnGuide && !$this->isManaged($returnGuide) && $last) {
            $minutes = (int) $last->diffInMinutes($now);

            return $minutes >= $limits['return_minutes'] ? [
                'type' => 'return',
                'minutes' => $minutes,
                'threshold' => $limits['return_minutes'],
                'since' => $last->format('h:i A'),
                'progress' => $progress,
                'return_to' => stripos($returnGuide['identifier'], 'TE') === 0 ? 'teusaquillo' : 'principal',
            ] : null;
        }

        return null;
    }
}
