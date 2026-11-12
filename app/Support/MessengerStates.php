<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Estados del mensajero en el dashboard y en cuáles se le puede asignar ruta.
 */
class MessengerStates
{
    public const STATES = [
        'disponible' => 'Disponible',
        'ruta' => 'En ruta',
        'almuerzo' => 'En almuerzo',
        'por-iniciar' => 'Por iniciar turno',
        'finalizado' => 'Finalizado',
    ];

    public const DEFAULT_ASSIGNABLE = ['disponible', 'ruta', 'almuerzo', 'por-iniciar'];

    public static function assignable(): array
    {
        $value = Setting::get('route_assignable_states');

        return is_array($value) ? array_values(array_intersect(array_keys(self::STATES), $value)) : self::DEFAULT_ASSIGNABLE;
    }

    /**
     * Estado de un mensajero con el mismo criterio que el dashboard.
     *
     * @param array $data   resultado de MessengerStatusService::formatMessengerData
     * @param bool  $onRoute si tiene una ruta activa en DispatchTrack
     */
    public static function of(array $data, bool $onRoute): string
    {
        if ($data['finished_info']) {
            return 'finalizado';
        }
        if ($onRoute) {
            return 'ruta';
        }
        if ($data['status'] === 'En Almuerzo') {
            return 'almuerzo';
        }
        if ($data['shift_start'] && now()->lt($data['shift_start'])) {
            return 'por-iniciar';
        }
        return 'disponible';
    }
}
