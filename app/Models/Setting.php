<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Configuración general editable desde la aplicación (clave → valor JSON).
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    protected $casts = ['value' => 'array'];

    public static function get(string $key, $default = null)
    {
        $value = Cache::rememberForever("setting.$key", fn() => static::where('key', $key)->first()?->value);

        return $value ?? $default;
    }

    public static function put(string $key, $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget("setting.$key");
    }
}
