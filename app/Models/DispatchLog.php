<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DispatchLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'messenger_id',
        'location_id',
        'consecutive',
        'guides_count',
        'source_batch',
        'user_id',
        'dt_status',
        'dt_route_id',
        'dt_truck',
        'dt_guides',
        'dt_sent_at',
        'date',
    ];

    protected $casts = [
        'dt_guides' => 'array',
        'dt_sent_at' => 'datetime',
    ];

    public function messenger()
    {
        return $this->belongsTo(Messenger::class);
    }

    public function location()
    {
        return $this->belongsTo(DispatchLocation::class, 'location_id');
    }
}
