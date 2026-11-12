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
    /**
     * Estado actual del mensajero con el mismo criterio del dashboard.
     * Si DispatchTrack no responde, se asume que no está en ruta.
     */
    private function messengerState(Messenger $messenger): string
    {
        $data = app(\App\Services\MessengerStatusService::class)->getSingleStatus($messenger->id);

        $normalize = fn($s) => preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $s));
        $onRoute = false;
        try {
            $status = app(\App\Services\BeetrackService::class)->getDispatchStatus();
            $onRoute = collect($status['activos'] ?? [])->contains(fn($r) => $messenger->vehicle && $normalize($r['unidad'] ?? '') === $normalize($messenger->vehicle));
        } catch (\Throwable $e) {
            \Log::warning('No se pudo consultar DispatchTrack al asignar ruta: ' . $e->getMessage());
        }

        return \App\Support\MessengerStates::of($data, $onRoute);
    }

    /**
     * Vista previa de un batch de Odoo (solo consulta): guías, productos y advertencias.
     */
    public function odooPreview(Request $request, \App\Services\OdooBatchService $odoo)
    {
        $request->validate(['batch' => 'required|string|max:100']);

        try {
            return response()->json($odoo->preview($request->input('batch')));
        } catch (\App\Services\OdooException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            // Origen de las guías: un batch de Odoo o, como respaldo, el Excel exportado
            'odoo_batch' => 'required_without:file|nullable|string|max:100',
            'file' => 'required_without:odoo_batch|nullable|file|mimes:xlsx,xls',
            'location_id' => 'required|exists:dispatch_locations,id',
            'messenger_id' => 'required|exists:messengers,id',
            'output_name' => 'required|string',
            'send_to_dispatchtrack' => 'nullable|boolean',
            'confirm_duplicates' => 'nullable|boolean',
        ]);

        // Crear la ruta directo en DispatchTrack: interruptor general + permiso propio + solo desde batch de Odoo
        $send = $request->boolean('send_to_dispatchtrack');
        $dispatchTrack = app(\App\Services\DispatchTrackRouteService::class);
        if ($send) {
            if (!$dispatchTrack->enabled()) {
                return response()->json(['message' => 'La creación de rutas en DispatchTrack está desactivada. Descarga el Excel.'], 403);
            }
            if (!$request->user()->hasPermission('dashboard.crear_ruta_dt')) {
                return response()->json(['message' => 'No tienes permiso para crear rutas en DispatchTrack.'], 403);
            }
            if (trim((string) $request->input('odoo_batch')) === '') {
                return response()->json(['message' => 'Para crear la ruta en DispatchTrack usa un batch de Odoo.'], 422);
            }
        }

        $location = DispatchLocation::findOrFail($request->location_id);
        $messenger = Messenger::findOrFail($request->messenger_id);

        // Solo en los estados que Configuración permite
        $state = $this->messengerState($messenger);
        if (!in_array($state, \App\Support\MessengerStates::assignable())) {
            return response()->json([
                'message' => 'No se puede asignar ruta a un mensajero en estado "' . \App\Support\MessengerStates::STATES[$state] . '".',
            ], 422);
        }
        $lastRoute = $request->boolean('last_route');
        $vehiclePlate = strtoupper($messenger->vehicle ?? 'SIN-PLACA');

        $batch = trim((string) $request->input('odoo_batch'));
        if ($batch !== '') {
            try {
                ['batch' => $batch, 'rows' => $rows] = app(\App\Services\OdooBatchService::class)->rows($batch);
            } catch (\App\Services\OdooException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        } else {
            $rows = Excel::toArray([], $request->file('file'))[0]; // Sheet 1
            $rows = array_slice($rows, 1); // Skip header
        }

        if ($send && !$request->boolean('confirm_duplicates')) {
            $duplicates = [];
            if (\App\Models\DispatchLog::where('source_batch', $batch)->whereNotNull('dt_sent_at')->whereDate('created_at', today())->exists()) {
                $duplicates[] = "El batch {$batch} ya se envió hoy a DispatchTrack.";
            }
            $guides = array_values(array_unique(array_map(fn($r) => (string) ($r[0] ?? ''), $rows)));
            $routed = $dispatchTrack->guidesAlreadyRouted($guides);
            if ($routed === null) {
                $duplicates[] = 'No se pudo verificar en DispatchTrack si las guías ya están en otra ruta.';
            } elseif ($routed) {
                $duplicates[] = 'Ya están en otra ruta de hoy: ' . implode(', ', $routed) . '.';
            }
            if ($duplicates) {
                return response()->json(['message' => 'Revisa antes de enviar.', 'duplicates' => $duplicates], 409);
            }
        }

        // Logic from procesar_archivo:
        // Columns: 0:guia, 1:producto, 2:cantidad, 3:id, 4:contacto, 5:tel, 6:email, 7:direccion, 8:horafinal, 9:prioridad, 10:info

        $processed = [];
        $currentInfo = '';
        $currentGuide = null;

        foreach ($rows as $row) {
            // La info se propaga solo dentro de la misma guía, nunca a la guía siguiente
            if (($row[0] ?? '') !== $currentGuide) {
                $currentGuide = $row[0] ?? '';
                $currentInfo = '';
            }

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
        return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $processed, $lastRoute, $location, $messenger, $vehiclePlate, $batch, $send, $dispatchTrack) {
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
                'contacto' => '',
                'telefono' => 'LFH',
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
        $log = \App\Models\DispatchLog::create([
            'messenger_id' => $messenger->id,
            'location_id' => $location->id,
            'user_id' => $request->user()?->id,
            'consecutive' => $nextGuide ?? 'LAST_ROUTE',
            'guides_count' => count($processed),
            'source_batch' => $batch !== '' ? $batch : null,
            'date' => now()->toDateString(),
        ]);

        $export = new class ($processed) implements FromCollection, WithHeadings {
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
        };

        if (!$send) {
            return Excel::download($export, $request->output_name . '.xlsx');
        }

        // Mismo archivo que hoy se importa a mano; si DispatchTrack lo rechaza se revierte todo (consecutivo y registro)
        try {
            $dispatchTrack->import(Excel::raw($export, \Maatwebsite\Excel\Excel::XLSX), $request->output_name . '.xlsx', now());
        } catch (\App\Services\DispatchTrackException $e) {
            throw new \Illuminate\Http\Exceptions\HttpResponseException(response()->json(['message' => $e->getMessage()], 502));
        }

        $log->update([
            'dt_status' => 'queued',
            'dt_truck' => $vehiclePlate,
            'dt_guides' => array_values(array_unique(array_column($processed, 'guia'))),
            'dt_sent_at' => now(),
        ]);

        return response()->json([
            'message' => 'Ruta enviada a DispatchTrack. Verificando que se cree…',
            'log_id' => $log->id,
        ]);
        });
    }

    /**
     * Estado de una ruta enviada a DispatchTrack (la importación es asíncrona).
     */
    public function dispatchTrackStatus(\App\Models\DispatchLog $dispatchLog, \App\Services\DispatchTrackRouteService $dispatchTrack)
    {
        $log = $dispatchTrack->confirm($dispatchLog);

        return response()->json([
            'status' => $log->dt_status,
            'route_id' => $log->dt_route_id,
            'message' => match ($log->dt_status) {
                'created' => 'Ruta creada en DispatchTrack.',
                'not_found' => 'DispatchTrack no muestra la ruta después de ' . \App\Services\DispatchTrackRouteService::CONFIRM_MINUTES . ' minutos. Revisa en DispatchTrack o descarga el Excel.',
                'queued' => 'DispatchTrack está procesando la ruta…',
                default => 'Esta ruta no se envió a DispatchTrack.',
            },
        ]);
    }
}
