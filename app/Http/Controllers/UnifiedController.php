<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\LunchLog;
use App\Models\Messenger;
use App\Models\DispatchLocation;
use App\Services\BeetrackService;
use Inertia\Inertia;

class UnifiedController extends Controller
{
    protected $statusService;

    public function __construct(\App\Services\MessengerStatusService $statusService)
    {
        $this->statusService = $statusService;
    }

    public function index()
    {
        $status = $this->statusService->getLocalStatus();

        return Inertia::render('Dashboard', [
            'messengers' => $status['messengers'],
            'dispatch_locations' => DispatchLocation::all(),
            'beetrack_data' => null,
        ]);
    }

    public function getMessengerStatus()
    {
        $status = $this->statusService->getLocalStatus();

        return response()->json([
            'messengers' => $status['messengers'],
            'timestamp' => now()->toDateTimeString()
        ]);
    }

    public function getBeetrackAsync(\App\Services\LiveAlertService $alertService)
    {
        $beetrackData = $this->statusService->getBeetrackStatus();

        try {
            $alerts = $alertService->alerts();
            $availableSince = $alertService->availableSince();
            $routeActivity = $alertService->routeActivity();
        } catch (\Exception $e) {
            \Log::warning('No se pudieron calcular las alertas: ' . $e->getMessage());
            $alerts = [];
            $availableSince = [];
            $routeActivity = [];
        }

        return response()->json([
            'beetrack_data' => $beetrackData,
            'alerts' => $alerts,
            'alert_limits' => config('services.beetrack.alerts'),
            'available_since' => (object) $availableSince,
            'route_activity' => (object) $routeActivity,
            'timestamp' => now()->toDateTimeString()
        ]);
    }
}
