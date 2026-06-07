<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckModule
{
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

        // Desarrollador y administrador tienen acceso a todo
        if (in_array($user->role, ['desarrollador', 'administrador'])) {
            return $next($request);
        }

        $userModules = $user->modules ?: [];

        // Si no tiene módulos asignados explícitamente, usar defaults por rol
        if (empty($userModules)) {
            $userModules = $this->defaultModulesForRole($user->role);
        }

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

    private function defaultModulesForRole(string $role): array
    {
        return match ($role) {
            'lider' => [
                'dashboard', 'shifts.index', 'messengers.index',
                'reports.lunch', 'reports.exit', 'reports.preoperational',
                'reports.cleaning', 'reports.global-stats',
                'external-forms.index', 'users.index', 'procedures.index',
            ],
            'regente' => ['reports.preoperational'],
            default => [],
        };
    }
}
