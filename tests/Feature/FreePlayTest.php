<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FreePlayTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.launcher.url' => 'http://launcher.test']);
    }

    public function test_starting_free_play_earns_the_badge_for_a_launcher_player(): void
    {
        Http::fake();
        $user = User::factory()->create(['launcher_id' => 7]);
        $user->launcher_token = 'player-token';
        $user->save();

        $this->actingAs($user)->postJson(route('freePlay.store'))->assertNoContent();

        Http::assertSent(fn ($request) => $request->method() === 'PUT'
            && $request->url() === 'http://launcher.test/api/badges/free-play'
            && $request->hasHeader('Authorization', 'Bearer player-token'));
    }

    public function test_guests_and_players_without_launcher_account_earn_nothing(): void
    {
        Http::fake();

        $this->postJson(route('freePlay.store'))->assertNoContent();
        $this->actingAs(User::factory()->create())->postJson(route('freePlay.store'))->assertNoContent();

        Http::assertNothingSent();
    }
}
