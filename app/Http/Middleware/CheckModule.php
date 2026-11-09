<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckModule
{
    public const MODULES = [
        'dashboard', 'shifts.index', 'messengers.index',
        'reports.lunch', 'reports.exit', 'reports.preoperational',
        'reports.cleaning', 'reports.global-stats',
        'external-forms.index', 'users.index', 'procedures.index',
    ];

    /**
     * Módulos a los que el usuario tiene acceso efectivo.
     */
    public static function modulesFor($user): array
    {
        if (in_array($user->role, ['desarrollador', 'administrador'])) {
            return self::MODULES;
        }

        return $user->modules ?: self::defaultModulesForRole($user->role);
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  $module
     */
    public function handle(Request $request, Closure $next, ...$modules): Response
    {
        $user = $request->user();

        if (!$user) {
            return redirect('/');
        }

        // Desarrollador y administrador tienen todos; el resto, sus módulos o los de su rol
        $userModules = self::modulesFor($user);

        // Verificar si el usuario tiene al menos uno de los módulos requeridos
        $hasAccess = false;
        foreach ($modules as $module) {
            if (in_array($module, $userModules)) {
                $hasAccess = true;
                break;
            }
        }

        if (!$hasAccess) {
            abort(403, 'No tienes permiso para acceder a este módulo.');
        }

        return $next($request);
    }

    private static function defaultModulesForRole(string $role): array
    {
        return match ($role) {
            'lider' => self::MODULES,
            'regente' => ['reports.preoperational'],
            default => [],
        };
    }
}
