<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\LauncherBadges;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LauncherBadgesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.launcher.url' => 'http://launcher.test']);
    }

    private function launcherPlayer(): User
    {
        $user = User::factory()->create(['launcher_id' => 7]);
        $user->launcher_token = 'player-token';
        $user->save();

        return $user;
    }

    public function test_earning_a_badge_sends_the_players_token_to_the_launcher(): void
    {
        Http::fake();

        app(LauncherBadges::class)->earn($this->launcherPlayer(), 'eerste-ronde');

        Http::assertSent(fn ($request) => $request->method() === 'PUT'
            && $request->url() === 'http://launcher.test/api/badges/eerste-ronde'
            && $request->hasHeader('Authorization', 'Bearer player-token'));
    }

    public function test_incrementing_sends_the_amount(): void
    {
        Http::fake();

        app(LauncherBadges::class)->increment($this->launcherPlayer(), 'muntenjager', 3);

        Http::assertSent(fn ($request) => $request['increment'] === 3);
    }

    public function test_guests_are_skipped(): void
    {
        Http::fake();

        app(LauncherBadges::class)->earn(User::factory()->create(), 'eerste-ronde');

        Http::assertNothingSent();
    }

    public function test_a_failing_launcher_does_not_break_the_game(): void
    {
        Http::fake(['*' => Http::response([], 500)]);

        app(LauncherBadges::class)->earn($this->launcherPlayer(), 'eerste-ronde');

        $this->assertTrue(true);
    }

    public function test_the_token_is_stored_encrypted(): void
    {
        $user = $this->launcherPlayer();

        $this->assertNotSame('player-token', $user->getRawOriginal('launcher_token'));
        $this->assertSame('player-token', $user->fresh()->launcher_token);
    }
}
