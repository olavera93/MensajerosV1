<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserController extends Controller
{
    private const MESSAGES = ['permissions.*.in' => 'Solo puedes otorgar permisos que tú tienes.'];

    /**
     * Se administra a un usuario solo si todos sus permisos están dentro de los propios:
     * así nadie puede cambiar la contraseña o los permisos de alguien con más acceso.
     * Al desarrollador solo lo administra otro desarrollador.
     */
    private function canManage(User $user, string $permission = 'usuarios.editar'): bool
    {
        $me = auth()->user();

        if ($me->isDeveloper()) {
            return true;
        }

        if ($user->isDeveloper() || !$me->hasPermission($permission)) {
            return false;
        }

        return empty(array_diff(Permissions::for($user), Permissions::for($me)));
    }

    private function permissionRules(): array
    {
        return [
            'permissions' => 'present|array',
            'permissions.*' => ['string', Rule::in(Permissions::for(auth()->user()))],
        ];
    }

    public function index()
    {
        $me = auth()->user();

        return Inertia::render('Users/Index', [
            'users' => User::orderBy('name')->get()->map(fn($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_developer' => $user->isDeveloper(),
                'permissions' => Permissions::for($user),
                'is_self' => $user->id === $me->id,
                'manageable' => $user->id === $me->id || $this->canManage($user),
                'deletable' => $user->id !== $me->id && $this->canManage($user, 'usuarios.eliminar'),
            ]),
            'catalog' => Permissions::catalog(),
            'grantable' => Permissions::for($me),
            'canCreate' => $me->hasPermission('usuarios.editar'),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            ...$this->permissionRules(),
        ], self::MESSAGES);

        User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'usuario',
            'permissions' => Permissions::normalize($validated['permissions']),
        ]);

        return redirect()->back()->with('success', 'Usuario creado correctamente.');
    }

    public function update(Request $request, User $user)
    {
        $isSelf = $user->id === auth()->id();

        if (!$isSelf && !$this->canManage($user)) {
            return redirect()->back()->withErrors(['permissions' => 'No tienes permiso para modificar este usuario.']);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            // Sobre la propia cuenta y sobre un desarrollador no se cambian permisos
            ...($isSelf || $user->isDeveloper() ? [] : $this->permissionRules()),
        ], self::MESSAGES);

        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
        ];

        if (!$isSelf && !$user->isDeveloper()) {
            $data['permissions'] = Permissions::normalize($validated['permissions']);
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

        if (!$this->canManage($user, 'usuarios.eliminar')) {
            return redirect()->back()->with('error', 'No tienes permiso para eliminar este usuario.');
        }

        $user->delete();

        return redirect()->back()->with('success', 'Usuario eliminado correctamente.');
    }
}
