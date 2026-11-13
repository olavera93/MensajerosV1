<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\LunchController;
use App\Http\Controllers\UnifiedController;
use App\Http\Controllers\DispatchController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PreoperationalController;
use App\Http\Controllers\ShiftCompletionController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\MessengerController;
use App\Http\Controllers\ExternalFormController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ProcedureController;
use App\Http\Controllers\PurgeController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\CleaningController;
use App\Http\Controllers\GlobalStatsController;
use App\Http\Controllers\SettingsController;

// Públicas / Login
Route::get('/', [AuthController::class, 'loginView'])->name('login');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1')->name('login.attempt');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

// Landing para Mensajeros (Sin Auth o con Auth básico si se prefiere, pero actualmente parece libre)
Route::get('/messenger', [LunchController::class, 'index'])->name('landing');
Route::post('/messenger/check-plate', [LunchController::class, 'checkPlate'])->name('messenger.check-plate');
Route::get('/messenger/{id}/shifts', [LunchController::class, 'getShifts'])->name('messenger.shifts');
Route::get('/messenger/{id}/events', [EventController::class, 'getForMessenger'])->name('messenger.events');
Route::post('/lunch', [LunchController::class, 'store'])->name('lunch.store');
Route::post('/shift-completion', [ShiftCompletionController::class, 'store'])->name('shift-completion.store');

// Preoperacional Frontend Routes (Para mensajeros)
Route::get('/preoperacional/questions', [PreoperationalController::class, 'getQuestions'])->name('preoperational.questions');
Route::post('/preoperacional/store', [PreoperationalController::class, 'store'])->name('preoperational.store');

// Aseo Frontend Routes
Route::post('/cleaning/store', [CleaningController::class, 'store'])->name('cleaning.store');

// Rutas protegidas: cada acción exige su permiso (ver App\Support\Permissions)
Route::middleware(['auth'])->group(function () {

    // 1. Dashboard
    Route::get('/dashboard', [UnifiedController::class, 'index'])->middleware('permission:dashboard.ver')->name('dashboard');

    // Datos en vivo que consume el dashboard (DispatchTrack, estados)
    Route::middleware(['permission:dashboard.ver,mensajeros.ver'])->group(function () {
        Route::get('/messenger-status', [UnifiedController::class, 'getMessengerStatus'])->name('messenger.status');
        Route::get('/messenger-status-beetrack', [UnifiedController::class, 'getBeetrackAsync'])->name('messenger.status.beetrack');
    });
    Route::middleware(['permission:dashboard.asignar_ruta'])->group(function () {
        Route::post('/dispatch', [DispatchController::class, 'store'])->name('dispatch.store');
        Route::get('/dispatch/odoo-preview', [DispatchController::class, 'odooPreview'])->middleware('throttle:30,1')->name('dispatch.odoo-preview');
        Route::get('/dispatch/{dispatchLog}/dispatchtrack', [DispatchController::class, 'dispatchTrackStatus'])->middleware('throttle:60,1')->name('dispatch.dispatchtrack-status');
    });

    // 2. Almuerzo
    Route::middleware(['permission:almuerzo.ver'])->group(function () {
        Route::get('/reports/lunch', [LunchController::class, 'report'])->name('reports.lunch');
        Route::get('/reports/lunch/data', [LunchController::class, 'data'])->name('reports.lunch.data');
    });
    Route::get('/reports/lunch/export', [LunchController::class, 'export'])->middleware('permission:almuerzo.exportar')->name('reports.lunch.export');

    // 3. Preoperacional
    Route::middleware(['permission:preoperacional.ver'])->group(function () {
        Route::get('/reports/preoperational', [PreoperationalController::class, 'report'])->name('reports.preoperational');
        Route::get('/reports/preoperational/data', [PreoperationalController::class, 'data'])->name('reports.preoperational.data');
        Route::get('/reports/preoperational/stats', [PreoperationalController::class, 'statsView'])->name('reports.preoperational.stats');
        Route::get('/reports/preoperational/stats/data', [PreoperationalController::class, 'statsData'])->name('reports.preoperational.stats.data');
    });
    Route::get('/reports/preoperational/export', [PreoperationalController::class, 'export'])->middleware('permission:preoperacional.exportar')->name('reports.preoperational.export');
    Route::middleware(['permission:preoperacional.preguntas'])->group(function () {
        Route::get('/reports/preoperational/questions', [PreoperationalController::class, 'questionsView'])->name('reports.preoperational.questions');
        Route::post('/reports/preoperational/questions', [PreoperationalController::class, 'storeQuestion'])->name('reports.preoperational.questions.store');
        Route::put('/reports/preoperational/questions/{id}', [PreoperationalController::class, 'updateQuestion'])->name('reports.preoperational.questions.update');
        Route::delete('/reports/preoperational/questions/{id}', [PreoperationalController::class, 'destroyQuestion'])->name('reports.preoperational.questions.destroy');
    });

    // 4. Aseo
    Route::middleware(['permission:aseo.ver'])->group(function () {
        Route::get('/reports/cleaning', [CleaningController::class, 'index'])->name('reports.cleaning');
        Route::get('/reports/cleaning/data', [CleaningController::class, 'data'])->name('reports.cleaning.data');
    });
    Route::get('/reports/cleaning/export', [CleaningController::class, 'export'])->middleware('permission:aseo.exportar')->name('reports.cleaning.export');

    // 5. Estadísticas Globales
    Route::middleware(['permission:estadisticas.ver'])->group(function () {
        Route::get('/reports/global-stats', [GlobalStatsController::class, 'index'])->name('reports.global-stats');
        Route::get('/reports/global-stats/data', [GlobalStatsController::class, 'data'])->name('reports.global-stats.data');
    });
    Route::get('/reports/global-stats/export', [GlobalStatsController::class, 'export'])->middleware('permission:estadisticas.exportar')->name('reports.global-stats.export');

    // 6. Reporte de Salida
    Route::middleware(['permission:salida.ver'])->group(function () {
        Route::get('/reports/exit', [ShiftCompletionController::class, 'index'])->name('reports.exit');
        Route::get('/reports/exit/data', [ShiftCompletionController::class, 'getExitAnalysis'])->name('reports.exit.data');
    });
    Route::get('/reports/exit/export', [ShiftCompletionController::class, 'export'])->middleware('permission:salida.exportar')->name('reports.exit.export');
    Route::post('/reports/exit/sync-dispatchtrack', [ShiftCompletionController::class, 'syncFromDispatchTrack'])->middleware('permission:salida.sincronizar')->name('reports.exit.sync');

    // 7. Gestión de Mensajeros
    Route::resource('messengers', MessengerController::class)->only(['index', 'show'])->middleware('permission:mensajeros.ver');
    Route::resource('messengers', MessengerController::class)->only(['create', 'store', 'edit', 'update'])->middleware('permission:mensajeros.editar');
    Route::resource('messengers', MessengerController::class)->only(['destroy'])->middleware('permission:mensajeros.eliminar');

    // 8. Horarios
    Route::get('/shifts', [ShiftController::class, 'index'])->middleware('permission:horarios.ver')->name('shifts.index');
    Route::get('/shifts/template', [ShiftController::class, 'exportTemplate'])->middleware('permission:horarios.editar,horarios.exportar')->name('shifts.template');
    Route::get('/shifts/export', [ShiftController::class, 'export'])->middleware('permission:horarios.exportar')->name('shifts.export');
    Route::middleware(['permission:horarios.editar'])->group(function () {
        Route::post('/shifts/import', [ShiftController::class, 'import'])->name('shifts.import');
        Route::resource('shifts', ShiftController::class)->only(['store', 'destroy']);
    });

    // 9. Formularios Externos
    Route::get('/external-forms', [ExternalFormController::class, 'index'])->middleware('permission:formularios.ver')->name('external-forms.index');
    Route::resource('external-forms', ExternalFormController::class)->only(['store', 'destroy'])->middleware('permission:formularios.editar');

    // 10. Usuarios
    Route::get('/users', [UserController::class, 'index'])->middleware('permission:usuarios.ver')->name('users.index');
    // Cada usuario puede editar sus propios datos; el controlador exige usuarios.editar para los demás
    Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::post('/users', [UserController::class, 'store'])->middleware('permission:usuarios.editar')->name('users.store');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('permission:usuarios.eliminar')->name('users.destroy');

    // Purga de datos: solo desarrollador
    Route::middleware(['role:desarrollador'])->group(function () {
        Route::get('/admin/purge/preview', [PurgeController::class, 'preview'])->name('admin.purge.preview');
        Route::post('/admin/purge/backup', [PurgeController::class, 'backup'])->name('admin.purge.backup');
        Route::post('/admin/purge/verify', [PurgeController::class, 'verifyPassword'])->name('admin.purge.verify');
        Route::post('/admin/purge/execute', [PurgeController::class, 'execute'])->name('admin.purge.execute');
    });

    // 11. Trámites
    Route::get('/procedures', [ProcedureController::class, 'index'])->middleware('permission:tramites.ver')->name('procedures.index');
    Route::get('/procedures/export', [ProcedureController::class, 'export'])->middleware('permission:tramites.exportar')->name('procedures.export');
    Route::middleware(['permission:tramites.editar'])->group(function () {
        Route::get('/procedures/import-template', [ProcedureController::class, 'importTemplate'])->name('procedures.import-template');
        Route::post('/procedures/import', [ProcedureController::class, 'import'])->name('procedures.import');
        Route::post('/procedures/bulk-update', [ProcedureController::class, 'bulkUpdate'])->name('procedures.bulk-update');
        Route::resource('procedures', ProcedureController::class)->only(['store', 'update']);
    });
    Route::resource('procedures', ProcedureController::class)->only(['destroy'])->middleware('permission:tramites.eliminar');

    // 12. Eventos
    Route::get('/events', [EventController::class, 'index'])->middleware('permission:eventos.ver')->name('events.index');
    Route::resource('events', EventController::class)->only(['store', 'update', 'destroy'])->middleware('permission:eventos.editar');

    // 13. Configuración
    Route::get('/settings', [SettingsController::class, 'index'])->middleware('permission:configuracion.ver')->name('settings.index');
    Route::put('/settings', [SettingsController::class, 'update'])->middleware('permission:configuracion.editar')->name('settings.update');
});
