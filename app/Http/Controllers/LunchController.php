<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\LunchLog;
use App\Models\Messenger;
use App\Exports\LunchReportsExport;
use Maatwebsite\Excel\Facades\Excel;
use App\Services\BeetrackService;
use Inertia\Inertia;

class LunchController extends Controller
{
    use \App\Traits\BroadcastsMessengerStatus;
    public function index()
    {
        return Inertia::render('Landing');
    }

    public function checkPlate(Request $request)
    {
        $request->validate(['plate' => 'required|string']);

        $plate = strtoupper(trim($request->plate));
        $messenger = Messenger::whereRaw('UPPER(TRIM(vehicle)) = ?', [$plate])->first();

        if (!$messenger) {
            return response()->json(['error' => 'Placa no encontrada'], 404);
        }

        if (!$messenger->is_active) {
            return response()->json(['error' => 'Mensajero inactivo. Contacte a su líder.'], 403);
        }

        $shiftFinished = $messenger->shiftCompletions()
            ->whereDate('finished_at', today())
            ->exists();

        $activeLunch = $messenger->lunchLogs()
            ->where('status', 'active')
            ->whereDate('start_time', today())
            ->latest()
            ->first();

        $preopFinished = $messenger->preoperationalReports()
            ->whereDate('created_at', today())
            ->exists();

        // Initialize response with basic info
        $response = [
            'id' => $messenger->id,
            'name' => $messenger->name,
            'vehicle' => $messenger->vehicle,
            'shift_finished' => $shiftFinished,
            'preop_finished' => $preopFinished,
        ];

        if ($activeLunch) {
            $response['active_lunch'] = [
                'start' => $activeLunch->start_time->format('H:i'),
                'end' => $activeLunch->end_time->format('H:i'),
            ];
        }

        $response['external_forms'] = \App\Models\ExternalForm::where('is_active', true)->get(['title', 'url']);

        return response()->json($response);
    }

    public function getShifts(Request $request, $id)
    {
        $messenger = Messenger::findOrFail($id);

        $week = $request->input('week', 'current');

        $start = $week === 'next'
            ? now()->addWeek()->startOfWeek()
            : now()->startOfWeek();

        $end = $start->copy()->endOfWeek();

        $dbShifts = $messenger->shifts()
            ->where('date', '>=', $start->format('Y-m-d'))
            ->where('date', '<=', $end->format('Y-m-d'))
            ->get()
            ->keyBy(fn($s) => substr($s->date, 0, 10));

        $shifts = collect();
        $current = $start->copy();

        while ($current <= $end) {
            $dateStr = $current->format('Y-m-d');
            $shift = $dbShifts->get($dateStr);

            $shifts->push([
                'date'       => $current->locale('es')->isoFormat('dddd D [de] MMMM'),
                'start_time' => $shift ? ($shift->status === 'absent' ? 'NO ASISTE' : ($shift->start_time ? substr($shift->start_time, 0, 5) : '-')) : 'SIN TURNO',
                'end_time'   => $shift ? ($shift->status === 'absent' ? '-' : ($shift->end_time ? substr($shift->end_time, 0, 5) : '-')) : '-',
                'status'     => $shift ? $shift->status : 'no_shift',
                'location'   => $shift ? ucfirst($shift->location) : '-',
                'is_today'   => $dateStr === today()->format('Y-m-d'),
            ]);

            $current->addDay();
        }

        return response()->json(['shifts' => $shifts]);
    }

    public function report(Request $request)
    {
        $date = $request->input('date', today()->toDateString());

        return Inertia::render('Reports/Lunch', [
            'filters' => ['start_date' => $date, 'end_date' => $date],
            'messengers' => Messenger::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function data(Request $request)
    {
        $query = LunchLog::with('messenger')
            ->whereHas('messenger', fn($q) => $q->where('is_active', true))
            ->orderBy('start_time', 'desc');

        if ($request->start_date) {
            $query->whereDate('start_time', '>=', $request->start_date);
        }
        if ($request->end_date) {
            $query->whereDate('start_time', '<=', $request->end_date);
        }

        $logs = $query->get()->map(fn($log) => [
            'id' => $log->id,
            'messenger' => $log->messenger->name ?? 'Desconocido',
            'date' => $log->start_time->format('d/m/Y'),
            'start_time' => $log->start_time->format('H:i'),
            'end_time' => $log->end_time->format('H:i'),
            'status' => $log->status,
        ]);

        return response()->json(['logs' => $logs]);
    }

    public function export(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $fileName = 'reporte_almuerzos_' . now()->format('Y-m-d_His') . '.xlsx';

        return Excel::download(
            new LunchReportsExport(
                $request->start_date,
                $request->end_date
            ),
            $fileName
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'messenger_id' => 'required|exists:messengers,id',
        ]);

        $messenger = Messenger::findOrFail($request->messenger_id);

        if (!$messenger->is_active) {
            return back()->withErrors(['messenger_inactive' => 'Tu usuario está inactivo.']);
        }

        // Check if already registered lunch today
        $existingLunch = LunchLog::where('messenger_id', $messenger->id)
            ->whereDate('start_time', today())
            ->first();

        if ($existingLunch) {
            return back()->withErrors([
                'lunch_duplicate' => 'Ya has registrado tu almuerzo hoy.',
                'lunch_end_time' => $existingLunch->end_time->format('H:i')
            ]);
        }

        $startTime = now();
        $endTime = $startTime->copy()->addMinutes($messenger->lunch_duration);

        LunchLog::create([
            'messenger_id' => $messenger->id,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'status' => 'active',
        ]);

        $this->broadcastStatus(false, $messenger, 'ha iniciado su almuerzo 🍔');

        return back()->with('success', [
            'message' => '¡A disfrutar! 🍔',
            'return_time' => $endTime->format('H:i'),
            'messenger_name' => $messenger->name,
        ]);
    }



    // Dashboard method moved to UnifiedController
    // public function dashboard() { ... }
}
