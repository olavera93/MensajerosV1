<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\Shift;
use App\Models\PreoperationalReport;
use App\Models\CleaningReport;
use App\Models\LunchLog;
use App\Models\ShiftCompletion;

class ThreeWeekActivitySeeder extends Seeder
{
    // Probabilidades por tarea (% de mensajeros que la completan cada día)
    const PROB_PREOP    = 85;
    const PROB_CLEANING = 80;
    const PROB_LUNCH    = 75;
    const PROB_EXIT     = 70;

    // Claves de las preguntas del preoperacional
    const PREOP_KEYS = [
        'frenos', 'luces', 'llantas', 'espejos', 'cadena', 'aceite', 'escape',
        'pito', 'suspension', 'casco', 'chaleco', 'guantes', 'calzado',
        'botiquin', 'herramientas', 'triangulos', 'soat', 'licencia',
        'tarjeta_propiedad', 'tecnomecanica', 'limpieza', 'placa',
    ];

    const CLEANING_TYPES = ['semanal_superficial', 'mensual_profunda'];
    const CLEANING_ITEMS = ['moto', 'maleta'];

    public function run(): void
    {
        $today     = Carbon::today();
        $startDate = $today->copy()->subWeeks(3)->startOfWeek(Carbon::MONDAY);

        $this->command->info("Sembrando actividad desde {$startDate->toDateString()} hasta {$today->toDateString()}…");

        // Recorre cada día de las últimas 3 semanas
        $date = $startDate->copy();
        while ($date->lte($today)) {
            // Solo Lun–Sáb (los turnos no incluyen domingo)
            if ($date->dayOfWeek === Carbon::SUNDAY) {
                $date->addDay();
                continue;
            }

            $dateStr = $date->toDateString();

            // Mensajeros con turno activo ese día
            $shifts = Shift::where('date', $dateStr)
                ->where('status', '!=', 'absent')
                ->whereHas('messenger', fn($q) => $q->where('is_active', true)->where('exclude_from_analytics', false))
                ->pluck('messenger_id');

            if ($shifts->isEmpty()) {
                $date->addDay();
                continue;
            }

            $preopRows    = [];
            $cleaningRows = [];
            $lunchRows    = [];
            $exitRows     = [];

            foreach ($shifts as $mid) {
                $baseTs = $date->copy();

                // Preoperacional (08:00 ± 30min)
                if ($this->hit(self::PROB_PREOP)) {
                    $preopTs = $baseTs->copy()->setTime(8, rand(0, 30));
                    $preopRows[] = [
                        'messenger_id' => $mid,
                        'answers'      => json_encode($this->randomAnswers()),
                        'observations' => $this->randomObs(),
                        'created_at'   => $preopTs,
                        'updated_at'   => $preopTs,
                    ];
                }

                // Aseo — una entrada por item (moto y/o maleta)
                if ($this->hit(self::PROB_CLEANING)) {
                    $cleanTs = $baseTs->copy()->setTime(7, rand(45, 59));
                    foreach (self::CLEANING_ITEMS as $item) {
                        $cleaningRows[] = [
                            'messenger_id' => $mid,
                            'item'         => $item,
                            'type'         => self::CLEANING_TYPES[rand(0, 1)],
                            'observations' => null,
                            'created_at'   => $cleanTs,
                            'updated_at'   => $cleanTs,
                        ];
                    }
                }

                // Almuerzo (12:00–14:00, duración 30–60 min)
                if ($this->hit(self::PROB_LUNCH)) {
                    $lunchStart = $baseTs->copy()->setTime(rand(12, 13), rand(0, 59));
                    $lunchEnd   = $lunchStart->copy()->addMinutes(rand(30, 60));
                    $lunchRows[] = [
                        'messenger_id' => $mid,
                        'start_time'   => $lunchStart,
                        'end_time'     => $lunchEnd,
                        'status'       => 'active',
                        'created_at'   => $lunchStart,
                        'updated_at'   => $lunchStart,
                    ];
                }

                // Fin de turno (17:30–19:30)
                if ($this->hit(self::PROB_EXIT)) {
                    $exitTs = $baseTs->copy()->setTime(rand(17, 19), rand(0, 59));
                    $exitRows[] = [
                        'messenger_id' => $mid,
                        'finished_at'  => $exitTs,
                        'created_at'   => $exitTs,
                        'updated_at'   => $exitTs,
                    ];
                }
            }

            // Inserta en bloques para rendimiento
            if ($preopRows)    DB::table('preoperational_reports')->insert($preopRows);
            if ($cleaningRows) DB::table('cleaning_reports')->insert($cleaningRows);
            if ($lunchRows)    DB::table('lunch_logs')->insert($lunchRows);
            if ($exitRows)     DB::table('shift_completions')->insert($exitRows);

            $this->command->line("  {$dateStr}: {$shifts->count()} mensajeros | preop=" . count($preopRows) . " aseo=" . (count($cleaningRows) / 2) . " almuerzo=" . count($lunchRows) . " salida=" . count($exitRows));

            $date->addDay();
        }

        $this->command->info('¡Listo!');
    }

    private function hit(int $percent): bool
    {
        return rand(1, 100) <= $percent;
    }

    private function randomAnswers(): array
    {
        return array_map(fn($key) => [
            'key'   => $key,
            'value' => $this->hit(92), // 92% de respuestas positivas
        ], self::PREOP_KEYS);
    }

    private function randomObs(): ?string
    {
        if (!$this->hit(15)) return null;
        $opts = [
            'Sin novedades', 'Llantas con desgaste moderado', 'Frenos revisados recientemente',
            'Cadena lubricada', 'Luces funcionando correctamente', 'Aceite en nivel óptimo',
        ];
        return $opts[array_rand($opts)];
    }
}
