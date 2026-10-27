<?php

namespace App\Console\Commands;

use App\Services\ShiftCompletionSyncService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SyncShiftCompletions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:sync-shift-completions
                            {--date= : Fecha a procesar (Y-m-d). Por defecto, ayer}
                            {--messenger= : ID de un mensajero específico}
                            {--dry-run : Muestra el resultado sin guardar}
                            {--dump : Imprime un despacho de ejemplo de la API para revisar sus campos}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Registra el fin de turno con la hora de la última guía de la última ruta en DispatchTrack.';

    /**
     * Execute the console command.
     */
    public function handle(ShiftCompletionSyncService $sync)
    {
        $date = $this->option('date') ? Carbon::parse($this->option('date')) : today()->subDay();

        if ($this->option('dump')) {
            $this->line(json_encode($sync->sampleDispatch($date), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            return self::SUCCESS;
        }

        try {
            $summary = $sync->sync($date, $this->option('messenger') ? (int) $this->option('messenger') : null, (bool) $this->option('dry-run'));
        } catch (\Exception $e) {
            $this->error('Error sincronizando con DispatchTrack: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->table(['Mensajero', 'Estado', 'Fin de turno', 'Detalle'], $summary['results']);
        $this->info("{$summary['date']}: {$summary['created']} creados, {$summary['updated']} actualizados, {$summary['unchanged']} sin cambios" . ($this->option('dry-run') ? ' (simulación)' : ''));

        return self::SUCCESS;
    }
}
