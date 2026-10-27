<?php

namespace App\Imports;

use App\Models\Messenger;
use App\Models\Shift;
use Maatwebsite\Excel\Concerns\RemembersRowNumber;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class ShiftsImport implements ToModel, WithHeadingRow
{
    use RemembersRowNumber;

    public int $imported = 0;
    public array $skipped = []; // Fila => motivo

    private $messengersByName;

    public function __construct()
    {
        // Mensajeros activos agrupados por nombre normalizado (coincidencia exacta)
        $this->messengersByName = Messenger::where('is_active', true)
            ->get()
            ->groupBy(fn($m) => $this->normalizeName($m->name));
    }

    public function model(array $row)
    {
        // Skip if date or name is missing
        if (!isset($row['fecha']) || !isset($row['nombre_mensajero'])) {
            return null;
        }

        try {
            // Find messenger by exact name (case-insensitive, active only)
            $name = trim($row['nombre_mensajero']);
            $matches = $this->messengersByName->get($this->normalizeName($name), collect());

            if ($matches->isEmpty()) {
                return $this->skip("Mensajero '{$name}' no encontrado o inactivo");
            }

            if ($matches->count() > 1) {
                return $this->skip("Hay varios mensajeros activos llamados '{$name}'");
            }

            $messenger = $matches->first();

            // Parse Date (Assuming Excel numeric date or Y-m-d)
            $date = $this->transformDate($row['fecha']);

            if (!$date) {
                return $this->skip("Fecha inválida '{$row['fecha']}'");
            }

            // Status handling
            $statusValue = strtolower(trim($row['estado'] ?? 'presente'));
            $status = ($statusValue === 'ausente' || $statusValue === 'no asiste') ? 'absent' : 'present';
            $location = strtolower(trim($row['ubicacion'] ?? 'principal')) === 'teusaquillo' ? 'teusaquillo' : 'principal';

            // Time parsing
            $startTime = null;
            $endTime = null;

            if ($status === 'present') {
                $startTime = $this->transformTime($row['hora_inicio'] ?? '08:00');
                $endTime = $this->transformTime($row['hora_fin'] ?? '17:00');

                if (!$startTime || !$endTime) {
                    return $this->skip('Hora de inicio o fin inválida');
                }
            }

            $shift = Shift::updateOrCreate(
                [
                    'messenger_id' => $messenger->id,
                    'date' => $date->format('Y-m-d'),
                ],
                [
                    'start_time' => $startTime,
                    'end_time' => $endTime,
                    'status' => $status,
                    'location' => $location,
                ]
            );
            $this->imported++;

            return $shift;

        } catch (\Exception $e) {
            Log::error('Error importing row: ' . json_encode($row) . ' Error: ' . $e->getMessage());
            return $this->skip('Error inesperado al procesar la fila');
        }
    }

    private function skip(string $reason)
    {
        $this->skipped[$this->getRowNumber()] = $reason;
        Log::warning("ShiftsImport: fila {$this->getRowNumber()} omitida: {$reason}");
        return null;
    }

    private function normalizeName(string $name): string
    {
        return mb_strtolower(preg_replace('/\s+/', ' ', trim($name)));
    }

    private function transformDate($value)
    {
        try {
            if (is_numeric($value)) {
                return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value);
            }
            return Carbon::parse($value);
        } catch (\Exception $e) {
            return null;
        }
    }

    private function transformTime($value)
    {
        try {
            if (is_numeric($value)) {
                return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value)->format('H:i');
            }
            return Carbon::parse($value)->format('H:i');
        } catch (\Exception $e) {
            return null;
        }
    }
}
