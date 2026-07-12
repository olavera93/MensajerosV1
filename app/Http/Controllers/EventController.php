<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Messenger;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;

class EventController extends Controller
{
    public function index()
    {
        $events = Event::with('messengers:id,name')
            ->orderBy('start_datetime')
            ->get()
            ->map(fn($e) => [
                'id'             => $e->id,
                'title'          => $e->title,
                'start_datetime' => $e->start_datetime->format('Y-m-d\TH:i'),
                'end_datetime'   => $e->end_datetime->format('Y-m-d\TH:i'),
                'scope'          => $e->scope,
                'messenger_ids'  => $e->messengers->pluck('id'),
                'messenger_names'=> $e->messengers->pluck('name'),
            ]);

        $messengers = Messenger::where('is_active', true)->orderBy('name')->get(['id', 'name']);

        return Inertia::render('Events/Index', [
            'events'     => $events,
            'messengers' => $messengers,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'          => 'required|string|max:255',
            'start_datetime' => 'required|date',
            'end_datetime'   => 'required|date|after_or_equal:start_datetime',
            'scope'          => 'required|in:all,specific',
            'messenger_ids'  => 'required_if:scope,specific|array',
            'messenger_ids.*'=> 'exists:messengers,id',
        ]);

        $event = Event::create([
            'title'          => $validated['title'],
            'start_datetime' => $validated['start_datetime'],
            'end_datetime'   => $validated['end_datetime'],
            'scope'          => $validated['scope'],
        ]);

        if ($validated['scope'] === 'specific') {
            $event->messengers()->sync($validated['messenger_ids'] ?? []);
        }

        return redirect()->back()->with('success', 'Evento creado.');
    }

    public function update(Request $request, Event $event)
    {
        $validated = $request->validate([
            'title'          => 'required|string|max:255',
            'start_datetime' => 'required|date',
            'end_datetime'   => 'required|date|after_or_equal:start_datetime',
            'scope'          => 'required|in:all,specific',
            'messenger_ids'  => 'required_if:scope,specific|array',
            'messenger_ids.*'=> 'exists:messengers,id',
        ]);

        $event->update([
            'title'          => $validated['title'],
            'start_datetime' => $validated['start_datetime'],
            'end_datetime'   => $validated['end_datetime'],
            'scope'          => $validated['scope'],
        ]);

        $event->messengers()->sync(
            $validated['scope'] === 'specific' ? ($validated['messenger_ids'] ?? []) : []
        );

        return redirect()->back()->with('success', 'Evento actualizado.');
    }

    public function destroy(Event $event)
    {
        $event->delete();
        return redirect()->back()->with('success', 'Evento eliminado.');
    }

    // API pública para el módulo de mensajeros
    public function getForMessenger(Request $request, $id)
    {
        $messenger = Messenger::findOrFail($id);

        $start = $request->filled('date')
            ? Carbon::parse($request->input('date'))->startOfWeek()
            : now()->startOfWeek();

        $end = $start->copy()->endOfWeek();

        $events = Event::with('messengers:id,name')
            ->where('start_datetime', '<=', $end->copy()->endOfDay())
            ->where('end_datetime',   '>=', $start->copy()->startOfDay())
            ->where(function ($q) use ($messenger) {
                $q->where('scope', 'all')
                  ->orWhereHas('messengers', fn($q2) => $q2->where('messengers.id', $messenger->id));
            })
            // "todos" primero, luego específicos, luego por fecha
            ->orderByRaw("CASE WHEN scope = 'all' THEN 0 ELSE 1 END")
            ->orderBy('start_datetime')
            ->get()
            ->map(fn($e) => [
                'id'             => $e->id,
                'title'          => $e->title,
                'start_datetime' => $e->start_datetime->locale('es')->isoFormat('dddd D [de] MMMM, HH:mm'),
                'end_datetime'   => $e->end_datetime->locale('es')->isoFormat('dddd D [de] MMMM, HH:mm'),
                'scope'          => $e->scope,
                'is_today'       => today()->between(
                    $e->start_datetime->copy()->startOfDay(),
                    $e->end_datetime->copy()->endOfDay()
                ),
            ]);

        return response()->json(['events' => $events])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate')
            ->header('Pragma', 'no-cache');
    }
}
