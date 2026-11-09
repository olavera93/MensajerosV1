<?php

namespace App\Http\Controllers;

use App\Http\Middleware\CheckModule;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserController extends Controller
{
    private const RANK = ['regente' => 1, 'lider' => 2, 'administrador' => 3, 'desarrollador' => 4];

    private const MESSAGES = ['modules.*.in' => 'Solo puedes otorgar módulos a los que tú tienes acceso.'];

    /**
     * Roles que el usuario autenticado puede asignar.
     * Evita que un rol inferior se otorgue (o otorgue) privilegios superiores.
     */
    private function assignableRoles(): array
    {
        return match (auth()->user()->role) {
            'desarrollador' => ['administrador', 'desarrollador', 'lider', 'regente'],
            'administrador' => ['administrador', 'lider', 'regente'],
            default => ['lider', 'regente'],
        };
    }

    /**
     * Módulos que el usuario autenticado puede otorgar: solo los que él mismo tiene.
     */
    private function grantableModules(): array
    {
        return CheckModule::modulesFor(auth()->user());
    }

    /**
     * Solo se administran usuarios de rango inferior; el desarrollador administra a todos.
     * Así nadie puede cambiar la contraseña o los permisos de un par o de un superior.
     */
    private function canManage(User $user): bool
    {
        $me = auth()->user();

        if ($me->role === 'desarrollador') {
            return true;
        }

        return (self::RANK[$user->role] ?? 0) < (self::RANK[$me->role] ?? 0);
    }

    private function modulesRules(): array
    {
        return [
            'modules' => 'nullable|array',
            'modules.*' => ['string', Rule::in($this->grantableModules())],
        ];
    }

    public function index()
    {
        return Inertia::render('Users/Index', [
            'users' => User::all()->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'modules' => $user->modules ?: [],
                    'is_self' => $user->id === auth()->id(),
                    'manageable' => $user->id === auth()->id() || $this->canManage($user),
                ];
            }),
            'assignableRoles' => $this->assignableRoles(),
            'grantableModules' => $this->grantableModules(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => ['required', Rule::in($this->assignableRoles())],
            ...$this->modulesRules(),
        ], self::MESSAGES);

        User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'modules' => $validated['modules'] ?? [],
        ]);

        return redirect()->back()->with('success', 'Usuario creado correctamente.');
    }

    public function update(Request $request, User $user)
    {
        $isSelf = $user->id === auth()->id();

        if (!$isSelf && !$this->canManage($user)) {
            return redirect()->back()->withErrors(['role' => 'No tienes permiso para modificar este usuario.']);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            // Sobre la propia cuenta no se cambian rol ni módulos
            ...($isSelf ? [] : [
                'role' => ['required', Rule::in($this->assignableRoles())],
                ...$this->modulesRules(),
            ]),
        ], self::MESSAGES);

        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
        ];

        if (!$isSelf) {
            $data['role'] = $validated['role'];
            $data['modules'] = $validated['modules'] ?? [];
        }

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        return redirect()->back()->with('success', 'Usuario actualizado correctamente.');
    }

    public function destroy(User $user)
    {
        if ($user->id === auth()->id()) {
            return redirect()->back()->with('error', 'No puedes eliminarte a ti mismo.');
        }

        if (!$this->canManage($user)) {
            return redirect()->back()->with('error', 'No tienes permiso para eliminar este usuario.');
        }

        $user->delete();

        return redirect()->back()->with('success', 'Usuario eliminado correctamente.');
    }
}
