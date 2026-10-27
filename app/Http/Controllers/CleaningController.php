<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CleaningReport;
use App\Models\Messenger;
use App\Exports\CleaningReportsExport;
use Maatwebsite\Excel\Facades\Excel;
use Inertia\Inertia;
use Carbon\Carbon;

use Illuminate\Support\Facades\Log;

class CleaningController extends Controller
{
    public function store(Request $request)
    {
        Log::info("Iniciando CleaningController@store", $request->all());
        // Fuera del try: una ValidationException debe responder 422, no 500
        $request->validate([
            'messenger_id' => 'required|exists:messengers,id',
            'item' => 'required|in:maleta,moto',
            'type' => 'required|in:semanal_superficial,mensual_profunda',
            'observations' => 'nullable|string',
        ]);
        Log::info("Validación exitosa");

        try {
            $messenger = Messenger::findOrFail($request->messenger_id);
            Log::info("Mensajero encontrado: " . $messenger->name);

            if (!$messenger->is_active) {
                Log::warning("Intento de registro con mensajero inactivo: " . $messenger->id);
                return response()->json(['error' => 'Tu usuario está inactivo.'], 403);
            }

            $existsToday = CleaningReport::where('messenger_id', $messenger->id)
                ->where('item', $request->item)
                ->where('type', $request->type)
                ->whereDate('created_at', today())
                ->exists();
            Log::info("Chequeo de duplicado hoy: " . ($existsToday ? 'SI' : 'NO'));

            if ($existsToday) {
                return response()->json(['error' => 'Ya has registrado este aseo el día de hoy.'], 403);
            }

            Log::info("Intentando crear CleaningReport...");
            CleaningReport::create([
                'messenger_id' => $messenger->id,
                'item' => $request->item,
                'type' => $request->type,
                'observations' => $request->observations,
            ]);
            Log::info("CleaningReport creado exitosamente");

            return response()->json([
                'success' => true,
                'message' => 'Reporte de aseo enviado correctamente.'
            ]);
        } catch (\Exception $e) {
            Log::error("ERROR CRÍTICO en CleaningController@store: " . $e->getMessage(), [
                'stack' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Error interno del servidor al procesar el reporte.',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * View for Leaders/Admins to see all cleaning reports.
     */
    public function index(Request $request)
    {
        $date = $request->input('date', today()->toDateString());
        return Inertia::render('Reports/Cleaning', [
            'filters' => ['start_date' => $date, 'end_date' => $date],
            'messengers' => Messenger::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * API: Get data for the datatable.
     */
    public function data(Request $request)
    {
        $query = CleaningReport::with('messenger')
            ->whereHas('messenger', fn($q) => $q->where('is_active', true))
            ->orderBy('created_at', 'desc');

        if ($request->start_date) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->end_date) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $logs = $query->get()->map(function ($log) {
            return [
                'id' => $log->id,
                'messenger' => $log->messenger->name ?? 'Desconocido',
                'vehicle' => $log->messenger->vehicle ?? 'N/A',
                'item' => $log->item === 'maleta' ? 'Maleta' : 'Motocicleta',
                'type' => $log->type === 'semanal_superficial' ? 'Semanal (Superficial)' : 'Mensual (Profunda)',
                'date' => $log->created_at->format('d/m/Y'),
                'time' => $log->created_at->format('H:i:s'),
                'observations' => $log->observations,
            ];
        });

        return response()->json(['logs' => $logs]);
    }

    /**
     * Export to Excel
     */
    public function export(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $fileName = 'aseo_' . now()->format('Y-m-d_His') . '.xlsx';

        return Excel::download(
            new CleaningReportsExport(
                $request->start_date,
                $request->end_date
            ),
            $fileName
        );
    }
}
