<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Support\MessengerStates;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class SettingsController extends Controller
{
    public function index()
    {
        return Inertia::render('Settings/Index', [
            'states' => collect(MessengerStates::STATES)->map(fn($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'assignable' => MessengerStates::assignable(),
            'canEdit' => auth()->user()->hasPermission('configuracion.editar'),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'assignable' => 'present|array',
            'assignable.*' => ['string', Rule::in(array_keys(MessengerStates::STATES))],
        ]);

        Setting::put('route_assignable_states', array_values(array_unique($validated['assignable'])));

        return redirect()->back()->with('success', 'Configuración guardada.');
    }
}
