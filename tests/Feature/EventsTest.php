<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Messenger;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventsTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $permissions): User
    {
        return User::create(['name' => 'Líder', 'email' => uniqid() . '@lfh.test', 'password' => 'secreto-123', 'role' => 'usuario', 'permissions' => $permissions]);
    }

    private function payload(array $extra = []): array
    {
        return array_merge(['title' => 'Capacitación', 'start_datetime' => '2026-11-16T08:00', 'end_datetime' => '2026-11-16T10:00', 'scope' => 'all'], $extra);
    }

    public function test_calendar_requires_the_view_permission(): void
    {
        $this->actingAs($this->user(['dashboard.ver']))->get(route('events.index'))->assertForbidden();
        $this->actingAs($this->user(['eventos.ver']))->get(route('events.index'))->assertOk();
    }

    public function test_view_only_users_cannot_change_events(): void
    {
        $event = Event::create($this->payload());
        $viewer = $this->user(['eventos.ver']);

        $this->actingAs($viewer)->post(route('events.store'), $this->payload())->assertForbidden();
        $this->actingAs($viewer)->put(route('events.update', $event), $this->payload(['title' => 'Otro']))->assertForbidden();
        $this->actingAs($viewer)->delete(route('events.destroy', $event))->assertForbidden();
        $this->assertSame(1, Event::count());
    }

    public function test_editor_creates_an_event_for_specific_messengers(): void
    {
        $messenger = Messenger::create(['name' => 'Mensajero Uno', 'vehicle' => 'ABC12D', 'is_active' => true]);

        $this->actingAs($this->user(['eventos.ver', 'eventos.editar']))
            ->post(route('events.store'), $this->payload(['scope' => 'specific', 'messenger_ids' => [$messenger->id]]))
            ->assertRedirect();

        $this->assertSame([$messenger->id], Event::first()->messengers->pluck('id')->all());
    }

    public function test_messenger_sees_general_events_and_their_own(): void
    {
        $this->travelTo('2026-11-16 09:00:00');
        $mine = Messenger::create(['name' => 'Mensajero Uno', 'vehicle' => 'ABC12D', 'is_active' => true]);
        $other = Messenger::create(['name' => 'Mensajero Dos', 'vehicle' => 'XYZ34E', 'is_active' => true]);

        Event::create($this->payload(['title' => 'Para todos']));
        Event::create($this->payload(['title' => 'Solo mío', 'scope' => 'specific']))->messengers()->sync([$mine->id]);
        Event::create($this->payload(['title' => 'De otro', 'scope' => 'specific']))->messengers()->sync([$other->id]);
        Event::create($this->payload(['title' => 'Otra semana', 'start_datetime' => '2026-11-30T08:00', 'end_datetime' => '2026-11-30T09:00']));

        $this->getJson(route('messenger.events', $mine->id) . '?date=2026-11-18')
            ->assertOk()
            ->assertJsonPath('events.*.title', ['Para todos', 'Solo mío'])
            ->assertJsonPath('events.0.is_today', true);
    }

    public function test_events_permission_requires_view(): void
    {
        $this->assertSame(['eventos.ver', 'eventos.editar'], \App\Support\Permissions::normalize(['eventos.editar']));
    }
}
