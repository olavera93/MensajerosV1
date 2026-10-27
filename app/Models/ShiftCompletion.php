<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Messenger;

class ShiftCompletion extends Model
{
    protected $fillable = ['messenger_id', 'finished_at', 'notes'];

    protected $casts = [
        'finished_at' => 'datetime',
    ];

    public function messenger()
    {
        return $this->belongsTo(Messenger::class);
    }
}
