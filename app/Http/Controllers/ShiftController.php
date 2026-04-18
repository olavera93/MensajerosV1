<?php

namespace App\Http\Controllers;

use App\Models\Messenger;
use App\Models\Shift;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;
use App\Imports\ShiftsImport;
use App\Exports\ShiftsTemplateExport;
use App\Exports\ShiftsExport;
use Maatwebsite\Excel\Facades\Excel;

class ShiftController extends Controller
{
    use \App\Traits\BroadcastsMessengerStatus;
    public function index(Request $request)
    {
        // Default to current week start if no date provided
        $date = $request->input('date') ? Carbon::parse($request->input('date')) : now();
        $startOfWeek = $date->copy()->startOfWeek();
        $endOfWeek = $date->copy()->endOfWeek();

        // Fetch messengers with shifts for the specific week
        $messengers = Messenger::where('is_active', true)->with([
            'shifts' => function ($query) use ($startOfWeek, $endOfWeek) {
                $query->whereBetween('date', [$startOfWeek->format('Y-m-d'), $endOfWeek->format('Y-m-d')]);
            }
        ])->get();

        return Inertia::render('Shifts/Index', [
            'messengers' => $messengers,
            'weekStart' => $startOfWeek->format('Y-m-d'),
            'weekEnd' => $endOfWeek->format('Y-m-d'),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'messenger_id' => 'required|exists:messengers,id',
            'date' => 'required|date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i|after:start_time',
            'status' => 'required|in:present,absent',
            'location' => 'required|string',
        ]);

        // Constraint: One shift per messenger per day
        Shift::updateOrCreate(
            [
                'messenger_id' => $validated['messenger_id'],
                'date' => $validated['date'],
            ],
            [
                'start_time' => $validated['status'] === 'absent' ? null : $validated['start_time'],
                'end_time' => $validated['status'] === 'absent' ? null : $validated['end_time'],
                'status' => $validated['status'],
                'location' => $validated['location'],
            ]
        );

        $this->broadcastStatus();

        return redirect()->back()->with('success', 'Turno actualizado correctamente.');
    }

    public function destroy($id)
    {
        $shift = Shift::findOrFail($id);
        $shift->delete();

        $this->broadcastStatus();

        return redirect()->back()->with('success', 'Turno eliminado correctamente.');
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls',
        ]);

        try {
            Excel::import(new ShiftsImport, $request->file('file'));
            $this->broadcastStatus();
            return redirect()->back()->with('success', 'Horarios importados correctamente.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['file' => 'Error al importar: ' . $e->getMessage()]);
        }
    }

    public function exportTemplate()
    {
        return Excel::download(new ShiftsTemplateExport, 'plantilla_horarios.xlsx');
    }

    public function export(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        return Excel::download(
            new ShiftsExport($request->start_date, $request->end_date),
            "horarios_{$request->start_date}_a_{$request->end_date}.xlsx"
        );
    }
}
