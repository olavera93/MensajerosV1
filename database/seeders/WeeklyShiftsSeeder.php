<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Messenger;
use App\Models\Shift;
use Carbon\Carbon;

class WeeklyShiftsSeeder extends Seeder
{
    // Horarios típicos: [inicio, fin]
    private array $schedules = [
        ['06:00', '14:00'],
        ['06:30', '14:30'],
        ['07:00', '15:00'],
        ['07:30', '15:30'],
        ['08:00', '16:00'],
        ['08:30', '16:30'],
        ['09:00', '17:00'],
    ];

    public function run(): void
    {
        $messengers = Messenger::where('is_active', true)->get();

        if ($messengers->isEmpty()) {
            $this->command->warn('No hay mensajeros activos.');
            return;
        }

        // Asignar a cada mensajero un horario fijo y ubicación base
        $messengerProfiles = [];
        foreach ($messengers as $messenger) {
            $messengerProfiles[$messenger->id] = [
                'schedule' => $this->schedules[array_rand($this->schedules)],
                'location' => $messenger->id <= 28 ? 'principal' : 'teusaquillo',
            ];
        }

        // Semana anterior + semana actual + próximas 4 semanas = 6 semanas
        $today = Carbon::today(); // 2026-07-11
        $weekStart = $today->copy()->startOfWeek(); // lunes de la semana actual

        $weeks = [];
        $weeks[] = $weekStart->copy()->subWeek();   // semana anterior
        $weeks[] = $weekStart->copy();              // semana actual
        for ($i = 1; $i <= 4; $i++) {
            $weeks[] = $weekStart->copy()->addWeeks($i);
        }

        $created = 0;
        $skipped = 0;

        foreach ($weeks as $weekMonday) {
            // Lunes a sábado (6 días)
            for ($dayOffset = 0; $dayOffset <= 5; $dayOffset++) {
                $date = $weekMonday->copy()->addDays($dayOffset);
                $dateStr = $date->toDateString();

                foreach ($messengers as $messenger) {
                    $profile = $messengerProfiles[$messenger->id];

                    // ~10% de ausencias en días pasados o actuales, 0% en futuros
                    $isAbsent = false;
                    if ($date->lte($today)) {
                        $isAbsent = (rand(1, 100) <= 10);
                    }

                    // Pequeña variación de horario (±0 o ±30min)
                    [$baseStart, $baseEnd] = $profile['schedule'];
                    if (!$isAbsent && rand(1, 100) <= 20) {
                        // 20% de probabilidad de llegar 30min tarde
                        $startCarbon = Carbon::createFromFormat('H:i', $baseStart)->addMinutes(30);
                        $endCarbon   = Carbon::createFromFormat('H:i', $baseEnd)->addMinutes(30);
                        $startTime = $startCarbon->format('H:i');
                        $endTime   = $endCarbon->format('H:i');
                    } else {
                        $startTime = $baseStart;
                        $endTime   = $baseEnd;
                    }

                    Shift::updateOrCreate(
                        [
                            'messenger_id' => $messenger->id,
                            'date'         => $dateStr,
                        ],
                        [
                            'start_time' => $isAbsent ? null : $startTime,
                            'end_time'   => $isAbsent ? null : $endTime,
                            'status'     => $isAbsent ? 'absent' : 'present',
                            'location'   => $profile['location'],
                        ]
                    );

                    $created++;
                }
            }

            $this->command->info("Semana del {$weekMonday->toDateString()} creada.");
        }

        $total = $messengers->count() * 6 * 6;
        $this->command->info("Turnos insertados/actualizados: {$created} ({$total} slots totales, 6 semanas × 6 días × {$messengers->count()} mensajeros)");
    }
}
