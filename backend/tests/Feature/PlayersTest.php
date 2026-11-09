<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlayersTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_a_visitor_can_start_a_guest_session(): void
    {
        $this->postJson(route('players.store'), ['name' => 'Tijs', 'character' => 'moss'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Tijs')
            ->assertJsonPath('data.character', 'moss')
            ->assertJsonPath('data.is_guest', true);

        $this->assertAuthenticated();
        $this->getJson(route('currentPlayer.show'))->assertSuccessful()->assertJsonPath('data.name', 'Tijs');
    }

    public function test_a_guest_needs_a_valid_name_and_character(): void
    {
        $this->postJson(route('players.store'), ['name' => '', 'character' => 'nobody'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'character']);
    }

    public function test_a_guest_can_change_name_and_character(): void
    {
        $this->actingAs($this->guest())
            ->patchJson(route('currentPlayer.update'), ['name' => 'Speedy', 'character' => 'zing'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Speedy')
            ->assertJsonPath('data.character', 'zing');
    }

    public function test_checking_for_a_session_without_one_returns_null(): void
    {
        $this->getJson(route('currentPlayer.show'))->assertOk()->assertExactJson(['data' => null]);
    }

    public function test_rooms_require_a_session(): void
    {
        $this->postJson(route('rooms.store'))->assertUnauthorized();
    }
}
