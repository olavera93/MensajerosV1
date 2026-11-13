<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    protected $fillable = ['title', 'start_datetime', 'end_datetime', 'scope'];

    protected $casts = [
        'start_datetime' => 'datetime',
        'end_datetime'   => 'datetime',
    ];

    public function messengers()
    {
        return $this->belongsToMany(Messenger::class);
    }
}
