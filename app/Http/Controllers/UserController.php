<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserController extends Controller
{
    /**
     * Roles que el usuario autenticado puede asignar o administrar.
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

    private function canManage(User $user): bool
    {
        return in_array($user->role, $this->assignableRoles());
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
                ];
            }),
            'assignableRoles' => $this->assignableRoles(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6',
            'role' => ['required', Rule::in($this->assignableRoles())],
            'modules' => 'nullable|array',
        ]);

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
        if (!$this->canManage($user)) {
            return redirect()->back()->withErrors(['role' => 'No tienes permiso para modificar este usuario.']);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:6',
            'role' => ['required', Rule::in($this->assignableRoles())],
            'modules' => 'nullable|array',
        ]);

        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'modules' => $validated['modules'] ?? [],
        ];

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
