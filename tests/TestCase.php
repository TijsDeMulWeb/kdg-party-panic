<?php

namespace Tests;

use App\Models\Character;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function guest(string $character = 'pip'): User
    {
        return User::factory()->create([
            'email' => null,
            'password' => null,
            'character_id' => Character::where('slug', $character)->value('id'),
        ]);
    }

    protected function roomWithPlayers(int $count): Room
    {
        $host = $this->guest('pip');

        $this->actingAs($host)->postJson(route('rooms.store'))->assertCreated();

        $room = Room::firstWhere('host_id', $host->id);

        collect(['blu', 'zing', 'moss'])
            ->take($count - 1)
            ->each(fn (string $character) => $this->actingAs($this->guest($character))
                ->postJson(route('roomMemberships.store', $room))
                ->assertOk());

        return $room->fresh();
    }
}
