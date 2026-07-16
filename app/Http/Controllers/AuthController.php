<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AuthController extends Controller
{
    public function loginView()
    {
        $props = [];

        if (app()->environment('local')) {
            $props['quickLoginUsers'] = User::orderBy('role')->orderBy('name')->get(['id', 'name', 'email', 'role']);
        }

        return Inertia::render('Auth/Login', $props);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (Auth::attempt($credentials, $request->boolean('remember'))) {
            $request->session()->regenerate();
            \Log::info('Login Success');

            return $this->redirectForRole($request, Auth::user());
        }

        return back()->withErrors([
            'email' => 'Las credenciales proporcionadas no coinciden con nuestros registros.',
        ])->onlyInput('email');
    }

    public function quickLogin(Request $request, User $user)
    {
        abort_unless(app()->environment('local'), 404);

        Auth::login($user);
        $request->session()->regenerate();

        return $this->redirectForRole($request, $user);
    }

    public function logout(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    private function redirectForRole(Request $request, User $user)
    {
        if ($user->role === 'administrador') {
            return redirect()->intended(route('dashboard'));
        }

        // Redirige al primer módulo (en orden de prioridad) al que el usuario
        // realmente tenga acceso, en vez de una ruta fija por rol.
        $firstAccessibleModule = collect(UserController::VALID_MODULES)
            ->first(fn ($module) => in_array($module, $user->modules ?: []));

        if ($firstAccessibleModule) {
            return redirect()->intended(route($firstAccessibleModule));
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->withErrors([
            'email' => 'Tu usuario no tiene módulos asignados. Contacta a un administrador.',
        ]);
    }
}
