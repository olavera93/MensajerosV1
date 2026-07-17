<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Messenger;
use App\Models\Shift;
use App\Models\PreoperationalReport;
use App\Models\CleaningReport;
use App\Models\LunchLog;
use App\Models\ShiftCompletion;
use Inertia\Inertia;
use Carbon\Carbon;
use App\Exports\GlobalOperationExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GlobalStatsController extends Controller
{
    /**
     * View for global statistics.
     */
    public function index(Request $request)
    {
        try {
            return Inertia::render('Reports/GlobalStats', [
                'filters' => [
                    'start_date' => $request->input('start_date', Carbon::now()->startOfMonth()->toDateString()),
                    'end_date' => $request->input('end_date', Carbon::now()->toDateString()),
                    'messenger_id' => $request->input('messenger_id', ''),
                ],
                'messengers' => Messenger::where('is_active', true)
                    ->where('exclude_from_analytics', false)
                    ->orderBy('name')
                    ->get(['id', 'name', 'vehicle']),
            ]);
        } catch (\Exception $e) {
            Log::error("Error in GlobalStatsController@index: " . $e->getMessage());
            return redirect()->back()->with('error', 'Error al cargar las estadísticas. Verifique la base de datos.');
        }
    }

    /**
     * API: Compliance alerts — which messengers missed tasks in a date range.
     */
    public function alerts(Request $request)
    {
        $start       = $request->input('start_date', Carbon::today()->toDateString());
        $end         = $request->input('end_date',   Carbon::today()->toDateString());
        $messengerId = $request->input('messenger_id');

        $shiftsQuery = Shift::whereBetween('date', [$start, $end])
            ->where('status', '!=', 'absent')
            ->whereHas('messenger', fn($q) => $q->where('is_active', true)->where('exclude_from_analytics', false))
            ->with('messenger:id,name');

        if ($messengerId) {
            $shiftsQuery->where('messenger_id', $messengerId);
        }

        $shifts = $shiftsQuery->get();

        if ($shifts->isEmpty()) {
            return response()->json(['alerts' => []]);
        }

        $ids = $shifts->pluck('messenger_id')->unique();

        // Sets de lookup "YYYY-MM-DD:messenger_id" para O(1)
        $preopSet = PreoperationalReport::whereBetween('created_at', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->whereIn('messenger_id', $ids)
            ->select('messenger_id', DB::raw('DATE(created_at) as dt'))
            ->distinct()->get()
            ->mapWithKeys(fn($r) => [$r->dt . ':' . $r->messenger_id => true]);

        $cleanSet = CleaningReport::whereBetween('created_at', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->whereIn('messenger_id', $ids)
            ->select('messenger_id', DB::raw('DATE(created_at) as dt'))
            ->distinct()->get()
            ->mapWithKeys(fn($r) => [$r->dt . ':' . $r->messenger_id => true]);

        $lunchSet = LunchLog::whereBetween('start_time', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->whereIn('messenger_id', $ids)
            ->select('messenger_id', DB::raw('DATE(start_time) as dt'))
            ->distinct()->get()
            ->mapWithKeys(fn($r) => [$r->dt . ':' . $r->messenger_id => true]);

        $exitSet = ShiftCompletion::whereBetween('created_at', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->whereIn('messenger_id', $ids)
            ->select('messenger_id', DB::raw('DATE(created_at) as dt'))
            ->distinct()->get()
            ->mapWithKeys(fn($r) => [$r->dt . ':' . $r->messenger_id => true]);

        $alerts = $shifts
            ->sort(fn($a, $b) => $a->date === $b->date
                ? strcmp($a->messenger->name, $b->messenger->name)
                : strcmp($a->date, $b->date))
            ->map(fn($s) => [
                'date'           => $s->date,
                'messenger_id'   => $s->messenger_id,
                'messenger_name' => $s->messenger->name,
                'preop'          => isset($preopSet[$s->date . ':' . $s->messenger_id]),
                'cleaning'       => isset($cleanSet[$s->date . ':' . $s->messenger_id]),
                'lunch'          => isset($lunchSet[$s->date . ':' . $s->messenger_id]),
                'exit'           => isset($exitSet[$s->date . ':' . $s->messenger_id]),
            ])
            ->values();

        return response()->json(['alerts' => $alerts]);
    }

    /**
     * Export global operational details to Excel.
     */
    public function export(Request $request)
    {
        $start = $request->input('start_date', Carbon::now()->startOfMonth()->toDateString());
        $end = $request->input('end_date', Carbon::now()->toDateString());
        $messengerId = $request->input('messenger_id');

        $fileName = 'Reporte_Global_Operativo_' . now()->format('Y-m-d_His') . '.xlsx';

        return Excel::download(
            new GlobalOperationExport($start, $end, $messengerId),
            $fileName
        );
    }

    /**
     * API: Get aggregated data for the global dashboard.
     */
    public function data(Request $request)
    {
        try {
            $startDateInput = $request->input('start_date');
            $endDateInput = $request->input('end_date');

            $start = $startDateInput ? Carbon::parse($startDateInput)->startOfDay() : Carbon::now()->startOfMonth();
            $end = $endDateInput ? Carbon::parse($endDateInput)->endOfDay() : Carbon::now()->endOfDay();
            $messengerId = $request->input('messenger_id');

            // 1. Messengers Stats (Only relevant if not filtering by specific messenger)
            $activeMessengersCount = Messenger::where('is_active', true)
                ->where('exclude_from_analytics', false)
                ->count();

            // 2. Shifts (Excluding "no asiste" / absent)
            $shiftsQuery = Shift::whereBetween('date', [$start->toDateString(), $end->toDateString()])
                ->where('status', '!=', 'absent')
                ->whereHas('messenger', function ($q) {
                    $q->where('exclude_from_analytics', false);
                });

            if ($messengerId) {
                $shiftsQuery->where('messenger_id', $messengerId);
            }

            $totalShifts = $shiftsQuery->count();

            // 3. Exit Reports (Reportes de Salida)
            $exitsQuery = ShiftCompletion::whereBetween('created_at', [$start, $end])
                ->whereHas('messenger', function ($q) {
                    $q->where('exclude_from_analytics', false);
                });
            if ($messengerId) {
                $exitsQuery->where('messenger_id', $messengerId);
            }
            $totalExits = $exitsQuery->count();

            // 4. Preoperational Reports (Total count)
            $preopQuery = PreoperationalReport::whereBetween('created_at', [$start, $end])
                ->whereHas('messenger', function ($q) {
                    $q->where('exclude_from_analytics', false);
                });
            if ($messengerId) {
                $preopQuery->where('messenger_id', $messengerId);
            }
            $preopCount = $preopQuery->count();

            // 5. Cleaning Stats
            $cleaningQuery = CleaningReport::whereBetween('created_at', [$start, $end])
                ->whereHas('messenger', function ($q) {
                    $q->where('exclude_from_analytics', false);
                });
            if ($messengerId) {
                $cleaningQuery->where('messenger_id', $messengerId);
            }
            $cleaningStats = $cleaningQuery->select('item', 'type', DB::raw('count(*) as total'))
                ->groupBy('item', 'type')
                ->get();

            // 6. Daily Activity Chart Data - Optimized for performance and null safety
            $period = new \DatePeriod($start, new \DateInterval('P1D'), $end);
            $chartData = [];

            // Pre-fetch collections for grouping
            $allShifts = $shiftsQuery->get();
            $allPreops = PreoperationalReport::whereBetween('created_at', [$start, $end])
                ->whereHas('messenger', function ($q) {
                    $q->where('exclude_from_analytics', false);
                })->when($messengerId, fn($q) => $q->where('messenger_id', $messengerId))
                ->get();

            $allCleaning = CleaningReport::whereBetween('created_at', [$start, $end])
                ->whereHas('messenger', function ($q) {
                    $q->where('exclude_from_analytics', false);
                })->when($messengerId, fn($q) => $q->where('messenger_id', $messengerId))
                ->get();

            $allExits = ShiftCompletion::whereBetween('created_at', [$start, $end])
                ->whereHas('messenger', function ($q) {
                    $q->where('exclude_from_analytics', false);
                })->when($messengerId, fn($q) => $q->where('messenger_id', $messengerId))
                ->get();

            // Group by Date for faster access inside the loop
            $shiftsByDate = $allShifts->groupBy('date');
            $preopsByDate = $allPreops->groupBy(fn($r) => $r->created_at ? $r->created_at->toDateString() : 'no-date');
            $cleaningByDate = $allCleaning->groupBy(fn($r) => $r->created_at ? $r->created_at->toDateString() : 'no-date');
            $exitsByDate = $allExits->groupBy(fn($r) => $r->created_at ? $r->created_at->toDateString() : 'no-date');

            foreach ($period as $date) {
                $dateStr = $date->format('Y-m-d');
                $chartData[] = [
                    'date' => $date->format('d/m'),
                    'shifts' => isset($shiftsByDate[$dateStr]) ? $shiftsByDate[$dateStr]->count() : 0,
                    'preoperational' => isset($preopsByDate[$dateStr]) ? $preopsByDate[$dateStr]->count() : 0,
                    'cleaning' => isset($cleaningByDate[$dateStr]) ? $cleaningByDate[$dateStr]->count() : 0,
                    'exits' => isset($exitsByDate[$dateStr]) ? $exitsByDate[$dateStr]->count() : 0,
                ];
            }

            return response()->json([
                'summary' => [
                    'active_messengers' => $activeMessengersCount,
                    'total_shifts' => $totalShifts,
                    'total_exits' => $totalExits,
                    'total_preop' => $preopCount,
                    'cleaning_summary' => $cleaningStats,
                ],
                'chart_data' => $chartData,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in GlobalStatsController@data: ' . $e->getMessage());
            return response()->json([
                'error' => 'Error al cargar las estadísticas',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
