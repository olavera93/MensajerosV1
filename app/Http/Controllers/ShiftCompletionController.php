<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\ShiftCompletion;
use App\Models\Messenger;
use App\Models\Shift;
use Carbon\Carbon;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ExitReportExport;

class ShiftCompletionController extends Controller
{
    use \App\Traits\BroadcastsMessengerStatus;
    public function store(Request $request)
    {
        $request->validate([
            'messenger_id' => 'required|exists:messengers,id',
        ]);

        $messenger = Messenger::findOrFail($request->messenger_id);

        if (!$messenger->is_active) {
            return back()->withErrors(['messenger_inactive' => 'Tu usuario está inactivo.']);
        }

        // Check if already completed today
        $existing = ShiftCompletion::where('messenger_id', $messenger->id)
            ->whereDate('finished_at', today())
            ->first();

        if ($existing) {
            return back()->withErrors([
                'shift_duplicate' => 'Ya has reportado tu fin de turno hoy.'
            ]);
        }

        ShiftCompletion::create([
            'messenger_id' => $messenger->id,
            'finished_at' => now(),
        ]);

        $this->broadcastStatus(false, $messenger, 'ha finalizado su turno 🏁');

        return back()->with('success', true);
    }

    public function index(Request $request)
    {
        return Inertia::render('Reports/Exit', [
            'messengers' => Messenger::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['start_date', 'end_date', 'messenger_id'])
        ]);
    }

    public function getExitAnalysis(Request $request)
    {
        $startDate = $request->input('start_date') ? Carbon::parse($request->input('start_date')) : now();
        $endDate = $request->input('end_date') ? Carbon::parse($request->input('end_date')) : now();
        $messengerId = $request->input('messenger_id');

        $query = Shift::with(['messenger', 'messenger.shiftCompletions'])
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()]);

        if ($messengerId) {
            $query->where('messenger_id', $messengerId);
        }

        $shifts = $query->orderBy('date', 'desc')->get();

        $analysis = $shifts->map(function ($shift) {
            // Find completion for this shift date
            $completion = $shift->messenger->shiftCompletions()
                ->whereDate('finished_at', $shift->date)
                ->first();

            if (!$completion || !$shift->end_time) {
                return null;
            }

            $scheduledEnd = Carbon::parse($shift->date . ' ' . $shift->end_time);
            $actualEnd = Carbon::parse($completion->finished_at);

            $diffMinutes = $scheduledEnd->diffInMinutes($actualEnd, false);

            return [
                'date' => $shift->date,
                'messenger' => $shift->messenger->name,
                'scheduled_end' => $scheduledEnd->format('H:i'),
                'actual_end' => $actualEnd->format('H:i'),
                'diff_minutes' => $diffMinutes,
                'status' => $diffMinutes > 15 ? 'late' : ($diffMinutes < -15 ? 'early' : 'on-time')
            ];
        })->filter()->values();

        // Calculate average diff (abs)
        $avgDiff = $analysis->count() > 0 ? round($analysis->avg(fn($a) => abs($a['diff_minutes']))) : 0;

        return response()->json([
            'history' => $analysis,
            'avg_diff' => $avgDiff
        ]);
    }

    public function syncFromDispatchTrack(Request $request, \App\Services\ShiftCompletionSyncService $sync)
    {
        $request->validate([
            'start_date' => 'required|date|before_or_equal:today',
            'end_date' => 'required|date|after_or_equal:start_date|before_or_equal:today',
            'messenger_id' => 'nullable|exists:messengers,id',
        ]);

        $start = Carbon::parse($request->start_date);
        $end = Carbon::parse($request->end_date);

        // Cada día toma ~15-20 s contra la API: se limita el rango para no agotar el tiempo de PHP
        if ($start->diffInDays($end) >= 7) {
            return response()->json(['error' => 'El rango no puede superar 7 días.'], 422);
        }

        set_time_limit(300);

        $totals = ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'skipped' => []];

        try {
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                $summary = $sync->sync($date->copy(), $request->messenger_id ? (int) $request->messenger_id : null);

                $totals['created'] += $summary['created'];
                $totals['updated'] += $summary['updated'];
                $totals['unchanged'] += $summary['unchanged'];
                foreach ($summary['results'] as $result) {
                    if ($result['status'] === 'skipped') {
                        $totals['skipped'][] = "{$summary['date']} {$result['messenger']}: {$result['detail']}";
                    }
                }
            }
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error sincronizando con DispatchTrack: ' . $e->getMessage()], 502);
        }

        if ($end->isToday() && ($totals['created'] + $totals['updated']) > 0) {
            try {
                $this->broadcastStatus();
            } catch (\Exception $e) {
                \Log::warning('No se pudo notificar el dashboard: ' . $e->getMessage());
            }
        }

        return response()->json($totals);
    }

    public function export(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'messenger_id' => 'nullable|exists:messengers,id',
        ]);

        $fileName = 'reporte_salidas_' . now()->format('Y-m-d_His') . '.xlsx';

        return Excel::download(
            new ExitReportExport(
                $request->start_date,
                $request->end_date,
                $request->messenger_id
            ),
            $fileName
        );
    }
}
