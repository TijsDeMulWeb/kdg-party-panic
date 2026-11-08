<?php

namespace Tests\Feature;

use App\Events\RoomUpdated;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class AccountsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_a_guest_upgrades_to_an_account_and_keeps_their_history(): void
    {
        $guest = $this->guest();
        $run = $this->actingAs($guest)->postJson(route('runs.store', 'color-crash'))->json('data');

        $this->actingAs($guest)
            ->postJson(route('accounts.store'), ['name' => 'Tijs', 'email' => 'tijs@example.com', 'password' => 'secret-password'])
            ->assertCreated()
            ->assertJsonPath('data.id', $guest->id)
            ->assertJsonPath('data.is_guest', false);

        $this->assertSame($guest->id, User::firstWhere('email', 'tijs@example.com')->id);
        $this->assertDatabaseHas('runs', ['id' => $run['id'], 'user_id' => $guest->id]);
    }

    public function test_a_player_can_log_in_and_out(): void
    {
        User::factory()->create(['email' => 'ana@example.com', 'password' => 'secret-password']);

        $this->postJson(route('session.store'), ['email' => 'ana@example.com', 'password' => 'wrong'])->assertJsonValidationErrors('email');
        $this->postJson(route('session.store'), ['email' => 'ana@example.com', 'password' => 'secret-password'])->assertOk();
        $this->assertAuthenticated();

        $this->deleteJson(route('session.destroy'))->assertNoContent();
        $this->assertGuest();
    }

    public function test_a_player_can_wear_a_hat(): void
    {
        $this->actingAs($this->guest())
            ->patchJson(route('currentPlayer.update'), ['hat' => 'crown'])
            ->assertOk()
            ->assertJsonPath('data.hat', 'crown');
    }

    public function test_a_new_hat_shows_up_in_the_party_lobby(): void
    {
        Event::fake([RoomUpdated::class]);
        $room = $this->roomWithPlayers(2);

        $this->actingAs($room->host)->patchJson(route('currentPlayer.update'), ['hat' => 'bow'])->assertOk();

        $this->actingAs($room->host)->getJson(route('rooms.show', $room))->assertJsonPath('data.players.0.hat', 'bow');
        Event::assertDispatched(RoomUpdated::class);
    }
}
