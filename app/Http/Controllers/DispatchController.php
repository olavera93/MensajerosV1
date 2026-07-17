<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\DispatchLocation;
use App\Models\Messenger;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\FromCollection;

class DispatchController extends Controller
{
    // Index method moved to UnifiedController
    // public function index() { ... }

    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls',
            'location_id' => 'required|exists:dispatch_locations,id',
            'messenger_id' => 'required|exists:messengers,id',
            'output_name' => 'required|string',
        ]);

        $file = $request->file('file');
        $location = DispatchLocation::findOrFail($request->location_id);
        $messenger = Messenger::findOrFail($request->messenger_id);
        $lastRoute = $request->boolean('last_route');
        $vehiclePlate = strtoupper($messenger->vehicle ?? 'SIN-PLACA');

        $rows = Excel::toArray([], $file)[0]; // Sheet 1
        $rows = array_slice($rows, 1); // Skip header

        // Logic from procesar_archivo:
        // Columns: 0:guia, 1:producto, 2:cantidad, 3:id, 4:contacto, 5:tel, 6:email, 7:direccion, 8:horafinal, 9:prioridad, 10:info

        $processed = [];
        $currentInfo = '';

        foreach ($rows as $row) {
            // 1. Cleaning HTML "limpiar_html_avanzado"
            $rawInfo = $row[10] ?? '';
            $cleanInfo = strip_tags(html_entity_decode($rawInfo));

            // 2. Propagation "llenamos los vacíos con el primer valor encontrado"
            // Python does: groupby('guia')['info'].transform('first'). 
            // In linear loop: if new guide has info, update current. If not, use current.
            // CAUTION: Python fills per GUIDE. If this row belongs to SAME guide as previous, use previous info.
            // If it's a NEW guide, reset? The python code says: "Agrupamos por guia... transform('first')".
            // Implementation: We need to map Guide -> First Info first?
            // "S537050 tiene INFO en fila 1, se copie a filas 2,3,4...".
            // Since we iterate linearly, we can check if guide changes.
            if (!empty($cleanInfo)) {
                $currentInfo = $cleanInfo;
            }
            // However, strictly speaking, Python does it by GROUP. 
            // If the input file is sorted by Guide, we can just latch. 
            // Let's assume sorted.

            $contact = explode(',', $row[4] ?? '')[0];

            // Email filter "lafarmacia"
            $email = $row[6] ?? '';
            if (str_contains(strtolower($email), 'lafarmacia'))
                $email = '';

            $processed[] = [
                'guia' => $row[0] ?? '',
                'vehiculo' => $vehiclePlate,
                'producto' => $row[1] ?? '',
                'cantidad' => $row[2] ?? '',
                'codigop' => '',
                'identificacion' => $row[3] ?? '',
                'contacto' => $contact,
                'telefono' => $row[5] ?? '',
                'email' => $email,
                'direccion' => $row[7] ?? '',
                'latitud' => '',
                'longitud' => '',
                'horainicio' => now()->format('Y/m/d H:i'),
                'horafinal' => (function () use ($row) {
                    $val = $row[8] ?? null;
                    if (!$val)
                        return '';
                    try {
                        if (is_numeric($val)) {
                            $dt = \Carbon\Carbon::instance(\PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($val));
                        } else {
                            $dt = \Carbon\Carbon::parse($val);
                        }
                        return ($dt->year < 2000 ? $dt->setDateFrom(now()) : $dt)->format('Y/m/d H:i');
                    } catch (\Exception $e) {
                        return '';
                    }
                })(),
                'ctdestino' => '',
                'prioridad' => ($row[9] ?? '') ?: 'Normal',
                'info' => $currentInfo, // Propagated
            ];
        }

        // Logic: if not last_route
        // "obtener_datos_ubicacion"
        if (!$lastRoute) {
            // Increment logic
            $consecutive = $location->current_consecutive;
            $prefix = $location->prefix;
            $location->increment('current_consecutive');

            $nextGuide = $prefix . $consecutive; // Use current then increment? Python: "Obtener... Incrementar...". So use OLD.

            // "direccion = direcciones_df..." -> In DB we store "address"
            $address = $location->address;

            // "Crear la nueva fila"
            $processed[] = [
                'guia' => $nextGuide,
                'vehiculo' => $vehiclePlate,
                'producto' => 'bodega' . $location->name, // "bodega{choice}"
                'cantidad' => '1',
                'codigop' => '',
                'identificacion' => '',
                'contacto' => 'LFH',
                'telefono' => '',
                'email' => '',
                'direccion' => $address,
                'latitud' => '',
                'longitud' => '',
                'horainicio' => now()->format('Y/m/d H:i'),
                'horafinal' => now()->setTime(23, 50)->format('Y/m/d H:i'),
                'ctdestino' => '',
                'prioridad' => 'Normal',
                'info' => '',
            ];
        }

        // Save log for statistics
        \App\Models\DispatchLog::create([
            'messenger_id' => $messenger->id,
            'location_id' => $location->id,
            'consecutive' => $nextGuide ?? 'LAST_ROUTE',
            'guides_count' => count($processed),
            'date' => now()->toDateString(),
        ]);

        return Excel::download(
            new class ($processed) implements FromCollection, WithHeadings {
            private $data;
            public function __construct($data)
            {
                $this->data = collect($data); }
            public function collection()
            {
                return $this->data; }
            public function headings(): array
            {
                return ['guia', 'vehiculo', 'producto', 'cantidad', 'codigop', 'identificacion', 'contacto', 'telefono', 'email', 'direccion', 'latitud', 'longitud', 'horainicio', 'horafinal', 'ctdestino', 'prioridad', 'info'];
            }
            },
            $request->output_name . '.xlsx'
        );
    }
}
