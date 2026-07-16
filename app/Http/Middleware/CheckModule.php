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

        // Administrador tiene acceso a todo
        if ($user->role === 'administrador') {
            return $next($request);
        }

        $userModules = $user->modules ?: [];

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
}
