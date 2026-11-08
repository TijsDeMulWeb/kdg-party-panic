<?php

namespace Tests\Feature;

use App\Events\RoomUpdated;
use App\Events\RoundStarting;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class RoomsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_creating_a_room_makes_the_creator_host_and_first_player(): void
    {
        $host = $this->guest('blu');

        $response = $this->actingAs($host)->postJson(route('rooms.store'))->assertCreated();

        $this->assertMatchesRegularExpression('/^[A-HJ-NP-Z2-9]{5}$/', $response->json('data.code'));
        $response
            ->assertJsonPath('data.host_id', $host->id)
            ->assertJsonPath('data.players.0.seat', 0)
            ->assertJsonPath('data.players.0.character', 'blu');
    }

    public function test_joining_assigns_the_next_seat_and_a_free_character(): void
    {
        $room = $this->roomWithPlayers(1);
        $joiner = $this->guest('pip');

        $this->actingAs($joiner)
            ->postJson(route('roomMemberships.store', $room))
            ->assertOk()
            ->assertJsonPath('data.players.1.id', $joiner->id)
            ->assertJsonPath('data.players.1.seat', 1)
            ->assertJsonPath('data.players.1.character', 'blu');
    }

    public function test_a_full_room_cannot_be_joined(): void
    {
        $room = $this->roomWithPlayers(4);

        $this->actingAs($this->guest())
            ->postJson(route('roomMemberships.store', $room))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('room');
    }

    public function test_only_members_can_view_a_room(): void
    {
        $room = $this->roomWithPlayers(1);

        $this->actingAs($this->guest())->getJson(route('rooms.show', $room))->assertForbidden();
        $this->actingAs($room->host)->getJson(route('rooms.show', $room))->assertOk();
    }

    public function test_players_can_toggle_ready_and_pick_a_free_character(): void
    {
        Event::fake([RoomUpdated::class]);
        $room = $this->roomWithPlayers(2);

        $this->actingAs($room->host)
            ->patchJson(route('roomMemberships.update', $room), ['is_ready' => true, 'character' => 'moss'])
            ->assertOk()
            ->assertJsonPath('data.players.0.is_ready', true)
            ->assertJsonPath('data.players.0.character', 'moss');

        Event::assertDispatched(RoomUpdated::class);
    }

    public function test_a_character_taken_by_another_player_cannot_be_picked(): void
    {
        $room = $this->roomWithPlayers(2);

        $this->actingAs($room->host)
            ->patchJson(route('roomMemberships.update', $room), ['character' => 'blu'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('character');
    }

    public function test_only_the_host_can_start_a_round(): void
    {
        $room = $this->roomWithPlayers(2);
        $guestPlayer = $room->players->firstWhere('id', '!=', $room->host_id);

        $this->actingAs($guestPlayer)->postJson(route('rounds.store', $room))->assertForbidden();
    }

    public function test_a_round_needs_two_ready_players(): void
    {
        $soloRoom = $this->roomWithPlayers(1);
        $this->setEveryoneReady($soloRoom);

        $this->actingAs($soloRoom->host)->postJson(route('rounds.store', $soloRoom))->assertUnprocessable();

        $room = $this->roomWithPlayers(2);

        $this->actingAs($room->host)
            ->postJson(route('rounds.store', $room))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('room');
    }

    public function test_the_host_starts_a_synchronised_round_when_everyone_is_ready(): void
    {
        Event::fake([RoundStarting::class, RoomUpdated::class]);
        $room = $this->roomWithPlayers(3);
        $this->setEveryoneReady($room);

        $response = $this->actingAs($room->host)
            ->postJson(route('rounds.store', $room))
            ->assertCreated()
            ->assertJsonPath('data.minigame', 'color-crash')
            ->assertJsonPath('data.number', 1);

        $this->assertGreaterThan(now()->getTimestampMs(), $response->json('data.starts_at'));
        $this->assertSame(30000, $response->json('data.ends_at') - $response->json('data.starts_at'));
        $this->assertTrue($room->isPlaying());
        $this->assertFalse($room->players()->wherePivot('is_ready', true)->exists());
        Event::assertDispatched(RoundStarting::class);
    }

    public function test_nobody_can_join_while_a_round_is_played(): void
    {
        $room = $this->roomWithPlayers(2);
        $this->setEveryoneReady($room);
        $this->actingAs($room->host)->postJson(route('rounds.store', $room))->assertCreated();

        $this->actingAs($this->guest())
            ->postJson(route('roomMemberships.store', $room))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('room');
    }

    public function test_the_host_role_moves_on_when_the_host_leaves(): void
    {
        $room = $this->roomWithPlayers(2);
        $host = $room->host;

        $this->actingAs($host)->deleteJson(route('roomMemberships.destroy', $room))->assertNoContent();

        $this->assertNotSame($host->id, $room->fresh()->host_id);
        $this->assertFalse($room->hasPlayer($host));
    }

    public function test_the_room_is_removed_when_the_last_player_leaves(): void
    {
        $room = $this->roomWithPlayers(1);

        $this->actingAs($room->host)->deleteJson(route('roomMemberships.destroy', $room))->assertNoContent();

        $this->assertModelMissing($room);
    }

    protected function setEveryoneReady(Room $room): void
    {
        $room->players()->newPivotQuery()->update(['is_ready' => true]);
    }
}
