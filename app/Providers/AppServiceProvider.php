<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Las exportaciones nunca convierten texto ingresado por usuarios en fórmulas
        config(['excel.value_binder.default' => \App\Support\SafeExcelValueBinder::class]);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
