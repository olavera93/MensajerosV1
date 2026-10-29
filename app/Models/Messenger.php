<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Messenger extends Model
{
    protected $fillable = ['name', 'vehicle', 'beetrack_id', 'lunch_duration', 'location', 'is_active', 'exclude_from_analytics'];

    // Solo quienes tienen usuario en DispatchTrack hacen rutas; el resto se registra para almuerzo y turnos
    public function scopeInDispatchTrack($query)
    {
        return $query->whereNotNull('beetrack_id')->where('beetrack_id', '!=', '');
    }

    public function lunchLogs()
    {
        return $this->hasMany(LunchLog::class);
    }

    public function shiftCompletions()
    {
        return $this->hasMany(ShiftCompletion::class);
    }

    public function shifts()
    {
        return $this->hasMany(Shift::class);
    }

    public function preoperationalReports()
    {
        return $this->hasMany(PreoperationalReport::class);
    }

    public function cleaningReports()
    {
        return $this->hasMany(CleaningReport::class);
    }
}
