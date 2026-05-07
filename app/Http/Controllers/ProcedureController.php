<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Procedure;
use App\Models\Messenger;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Concerns\WithStartRow;

class ProcedureController extends Controller
{
    public function index(Request $request)
    {
        $query = Procedure::query();
        $perPage = $request->input('per_page', 30);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('date')) {
            $query->whereDate('start_date', $request->date);
        }

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('guide', 'like', '%' . $request->search . '%')
                    ->orWhere('product', 'like', '%' . $request->search . '%')
                    ->orWhere('contact_name', 'like', '%' . $request->search . '%')
                    ->orWhere('phone', 'like', '%' . $request->search . '%');
            });
        }

        return Inertia::render('Procedures/Index', [
            'procedures' => $query->latest()->paginate($perPage)->withQueryString(),
            'messengers' => Messenger::where('is_active', true)->get(),
            'filters' => $request->only(['status', 'date', 'search', 'per_page']),
            'stats' => [
                'total' => Procedure::count(),
                'pendiente' => Procedure::where('status', 'pendiente')->count(),
                'en_ruta' => Procedure::where('status', 'en_ruta')->count(),
                'completado' => Procedure::where('status', 'completado')->count(),
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'guide' => 'nullable|string',
            'product' => 'nullable|string',
            'quantity' => 'nullable|string',
            'client_id' => 'nullable|string',
            'contact_name' => 'nullable|string',
            'phone' => 'nullable|string',
            'email' => 'nullable|string',
            'address' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'priority' => 'nullable|string',
            'info' => 'nullable|string',
            'management_notes' => 'nullable|string',
            'messenger_id' => 'nullable|exists:messengers,id',
        ]);

        // Auto-generación de guía si no se proporciona
        if (empty($validated['guide'])) {
            $lastProcedure = Procedure::where('guide', 'like', 'TRAMITE%')
                ->orderByRaw('CAST(SUBSTRING(guide, 8) AS UNSIGNED) DESC')
                ->first();

            if ($lastProcedure) {
                $lastNumber = intval(substr($lastProcedure->guide, 7));
                $nextNumber = $lastNumber + 1;
            } else {
                $nextNumber = 1;
            }
            $validated['guide'] = 'TRAMITE' . $nextNumber;
        }

        Procedure::create([
            ...$validated,
            'user_id' => auth()->id(),
            'status' => 'pendiente',
        ]);

        return redirect()->back()->with('success', 'Trámite ' . $validated['guide'] . ' registrado correctamente.');
    }

    public function update(Request $request, Procedure $procedure)
    {
        $validated = $request->validate([
            'guide' => 'nullable|string',
            'product' => 'nullable|string',
            'quantity' => 'nullable|string',
            'client_id' => 'nullable|string',
            'contact_name' => 'nullable|string',
            'phone' => 'nullable|string',
            'email' => 'nullable|string',
            'address' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'priority' => 'nullable|string',
            'info' => 'nullable|string',
            'management_notes' => 'nullable|string',
            'messenger_id' => 'nullable|exists:messengers,id',
            'status' => 'required|string',
        ]);

        $procedure->update($validated);

        return redirect()->back()->with('success', 'Trámite actualizado correctamente.');
    }

    public function destroy(Procedure $procedure)
    {
        $procedure->delete();
        return redirect()->back()->with('success', 'Trámite eliminado correctamente.');
    }

    public function export(Request $request)
    {
        $ids = $request->input('ids', []);
        $query = Procedure::query();

        if (!empty($ids)) {
            $query->whereIn('id', $ids);
        } else {
            $query->where('status', 'pendiente');
        }

        $procedures = $query->with('messenger')->get();

        $processed = $procedures->map(function ($p) {
            return [
                'guia' => $p->guide ?? '',
                'vehiculo' => $p->messenger ? strtoupper($p->messenger->vehicle) : 'SIN-PLACA',
                'producto' => $p->product ?? '',
                'cantidad' => $p->quantity ?? '1',
                'codigop' => '',
                'identificacion' => $p->client_id ?? '',
                'contacto' => $p->contact_name ?? '',
                'telefono' => $p->phone ?? '',
                'email' => $p->email ?? '',
                'direccion' => $p->address ?? '',
                'latitud' => '',
                'longitud' => '',
                'horainicio' => $p->start_date ? \Carbon\Carbon::parse($p->start_date)->format('Y/m/d H:i') : '',
                'horafinal' => $p->end_date ? \Carbon\Carbon::parse($p->end_date)->format('Y/m/d H:i') : '',
                'ctdestino' => '',
                'prioridad' => $p->priority ?? 'Normal',
                'info' => $p->info ?? '',
            ];
        });

        return Excel::download(
            new class ($processed) implements FromCollection, WithHeadings {
            private $data;
            public function __construct($data)
            {
                $this->data = collect($data);
            }
            public function collection()
            {
                return $this->data;
            }
            public function headings(): array
            {
                return ['guia', 'vehiculo', 'producto', 'cantidad', 'codigop', 'identificacion', 'contacto', 'telefono', 'email', 'direccion', 'latitud', 'longitud', 'horainicio', 'horafinal', 'ctdestino', 'prioridad', 'info'];
            }
            },
            'tramites_beetrack_' . now()->format('Ymd_His') . '.xlsx'
        );
    }

    public function importTemplate()
    {
        $headers = ['producto', 'cantidad', 'identificacion', 'contacto', 'telefono', 'email', 'direccion', 'horainicio', 'horafinal', 'prioridad', 'info', 'notas_gestion'];

        $examples = collect([
            ['Documentos notariales', '1', '1020304050', 'Ana García', '3001234567', 'ana@correo.com', 'Calle 45 # 12-30, Bogotá', '2026-04-15 08:00', '2026-04-15 12:00', 'Normal', 'Entregar en portería', 'Cliente preferencial'],
            ['Paquete electrónico',   '2', '9876543210', 'Luis Torres', '3109876543', 'luis@empresa.com', 'Carrera 7 # 80-15, Bogotá', '2026-04-15 14:00', '2026-04-15 18:00', 'Alta',   'Requiere firma del destinatario', ''],
        ]);

        return Excel::download(
            new class ($headers, $examples) implements FromCollection, WithHeadings {
                private $headers, $examples;
                public function __construct($headers, $examples) { $this->headers = $headers; $this->examples = $examples; }
                public function collection() { return $this->examples; }
                public function headings(): array { return $this->headers; }
            },
            'plantilla_tramites.xlsx'
        );
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv',
        ], [
            'file.required' => 'Debes seleccionar un archivo.',
            'file.mimes'    => 'El archivo debe ser .xlsx, .xls o .csv.',
        ]);

        $rows = Excel::toArray(new class implements ToArray {
            public function array(array $array): array { return $array; }
        }, $request->file('file'));

        if (empty($rows) || empty($rows[0])) {
            return redirect()->back()->with('error', 'El archivo está vacío.');
        }

        $sheet   = $rows[0];
        $headers = array_map('strtolower', array_map('trim', $sheet[0]));
        $dataRows = array_slice($sheet, 1);

        $map = [
            'producto'       => 'product',
            'cantidad'       => 'quantity',
            'identificacion' => 'client_id',
            'contacto'       => 'contact_name',
            'telefono'       => 'phone',
            'email'          => 'email',
            'direccion'      => 'address',
            'horainicio'     => 'start_date',
            'horafinal'      => 'end_date',
            'prioridad'      => 'priority',
            'info'           => 'info',
            'notas_gestion'  => 'management_notes',
        ];

        $created = 0;

        foreach ($dataRows as $row) {
            // Ignorar filas completamente vacías
            if (empty(array_filter($row, fn($v) => $v !== null && $v !== ''))) {
                continue;
            }

            $data = [];
            foreach ($headers as $i => $header) {
                if (isset($map[$header]) && isset($row[$i])) {
                    $data[$map[$header]] = trim((string) $row[$i]);
                }
            }

            // Auto-generar guía (siempre, no viene del archivo)
            $last  = Procedure::where('guide', 'like', 'TRAMITE%')
                ->orderByRaw('CAST(SUBSTRING(guide, 8) AS UNSIGNED) DESC')
                ->first();
            $next  = $last ? (intval(substr($last->guide, 7)) + 1) : 1;
            $guide = 'TRAMITE' . $next;

            foreach (['start_date', 'end_date'] as $dateField) {
                if (!empty($data[$dateField])) {
                    try {
                        $value = $data[$dateField];

                        if (is_numeric($value)) {
                            $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $value);
                            $data[$dateField] = \Carbon\Carbon::instance($dt)->format('Y-m-d H:i:s');
                        } else {
                            $parsed = null;
                            foreach (['Y-m-d H:i:s', 'Y-m-d H:i', 'd/m/Y H:i', 'd/m/Y', 'Y-m-d'] as $fmt) {
                                try {
                                    $candidate = \Carbon\Carbon::createFromFormat($fmt, trim($value));
                                    if ($candidate !== false) { $parsed = $candidate; break; }
                                } catch (\Exception $e) {}
                            }
                            if (!$parsed) {
                                try { $parsed = \Carbon\Carbon::parse($value); } catch (\Exception $e) {}
                            }
                            $data[$dateField] = $parsed ? $parsed->format('Y-m-d H:i:s') : null;
                        }
                    } catch (\Exception $e) {
                        $data[$dateField] = null;
                    }
                } else {
                    $data[$dateField] = null;
                }
            }

            Procedure::create([
                ...$data,
                'guide'   => $guide,
                'status'  => 'pendiente',
                'user_id' => auth()->id(),
            ]);

            $created++;
        }

        return redirect()->back()->with('success', "{$created} trámite(s) importado(s) correctamente.");
    }

    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:procedures,id',
            'status' => 'nullable|string',
            'messenger_id' => 'nullable|exists:messengers,id',
        ]);

        $updateData = [];
        if (isset($validated['status']))
            $updateData['status'] = $validated['status'];
        if (isset($validated['messenger_id']))
            $updateData['messenger_id'] = $validated['messenger_id'];

        if (!empty($updateData)) {
            Procedure::whereIn('id', $validated['ids'])->update($updateData);
        }

        return redirect()->back()->with('success', count($validated['ids']) . ' trámites actualizados correctamente.');
    }
}
