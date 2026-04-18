<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestBeetrackCommand extends Command
{
    protected $signature = 'beetrack:test';
    protected $description = 'Test Beetrack API connection and show route counts per messenger';

    public function handle()
    {
        $apiKey = config('services.beetrack.api_key');
        $baseUrl = config('services.beetrack.url');
        $today = now()->format('d-m-Y');

        $this->info("🔍 Testing Beetrack API Connection...");
        $this->info("📅 Date: {$today}");
        $this->newLine();

        try {
            $response = Http::withHeaders([
                'X-AUTH-TOKEN' => $apiKey,
            ])->get($baseUrl, [
                        'date' => $today,
                    ]);

            if (!$response->successful()) {
                $this->error("❌ API Request Failed!");
                $this->error("Status: " . $response->status());
                $this->error("Body: " . $response->body());
                return 1;
            }

            $data = $response->json();
            $routes = $data['response']['routes'] ?? [];

            $this->info("✅ API Connection Successful!");
            $this->info("📊 Total Routes Today: " . count($routes));
            $this->newLine();

            // Count routes per messenger
            $messengerRoutes = [];

            foreach ($routes as $route) {
                $driverName = $route['driver_name'] ?? $route['driver_identifier'] ?? 'Unknown';
                $routeId = $route['id'] ?? 'N/A';
                $startedAt = $route['started_at'] ?? null;
                $endedAt = $route['ended_at'] ?? null;
                $vehicle = $route['truck']['identifier'] ?? 'N/A';

                if (!isset($messengerRoutes[$driverName])) {
                    $messengerRoutes[$driverName] = [
                        'total_routes' => 0,
                        'active_routes' => 0,
                        'finished_routes' => 0,
                        'vehicle' => $vehicle,
                        'routes' => []
                    ];
                }

                $messengerRoutes[$driverName]['total_routes']++;

                $status = 'Pending';
                if ($startedAt && !$endedAt) {
                    $status = 'Active';
                    $messengerRoutes[$driverName]['active_routes']++;
                } elseif ($endedAt) {
                    $status = 'Finished';
                    $messengerRoutes[$driverName]['finished_routes']++;
                }

                $messengerRoutes[$driverName]['routes'][] = [
                    'id' => $routeId,
                    'status' => $status,
                    'started' => $startedAt ? substr($startedAt, 11, 5) : '-',
                    'ended' => $endedAt ? substr($endedAt, 11, 5) : '-',
                ];
            }

            // Display results
            $this->table(
                ['Mensajero', 'Vehículo', 'Total Rutas', 'Activas', 'Finalizadas'],
                collect($messengerRoutes)->map(function ($data, $name) {
                    return [
                        $name,
                        $data['vehicle'],
                        $data['total_routes'],
                        $data['active_routes'],
                        $data['finished_routes'],
                    ];
                })->values()
            );

            $this->newLine();
            $this->info("📋 Detailed Route Information:");
            $this->newLine();

            foreach ($messengerRoutes as $name => $data) {
                $this->line("<fg=cyan>👤 {$name}</> ({$data['vehicle']})");
                foreach ($data['routes'] as $route) {
                    $statusColor = $route['status'] === 'Active' ? 'yellow' : ($route['status'] === 'Finished' ? 'green' : 'gray');
                    $this->line("   └─ Route #{$route['id']}: <fg={$statusColor}>{$route['status']}</> | Started: {$route['started']} | Ended: {$route['ended']}");
                }
                $this->newLine();
            }

            return 0;

        } catch (\Exception $e) {
            $this->error("❌ Exception: " . $e->getMessage());
            return 1;
        }
    }
}
