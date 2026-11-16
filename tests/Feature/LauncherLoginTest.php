<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as LauncherUser;
use Tests\TestCase;

class LauncherLoginTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function launcherUser(int $id = 7, string $firstName = 'Tijs'): LauncherUser
    {
        return (new LauncherUser)->map([
            'id' => $id,
            'name' => "{$firstName} De Mul",
            'first_name' => $firstName,
            'last_name' => 'De Mul',
            'avatar' => null,
        ]);
    }

    private function fakeLauncherLogin(LauncherUser $launcherUser): void
    {
        Socialite::shouldReceive('driver->user')->andReturn($launcherUser);
    }

    public function test_the_launcher_button_sends_the_player_to_the_launcher(): void
    {
        config([
            'services.launcher.url' => 'http://launcher.test',
            'services.launcher.client_id' => 'client-id',
            'services.launcher.redirect' => 'http://party-panic.test/auth/callback',
        ]);

        $this->get(route('launcher.redirect'))->assertRedirectContains('http://launcher.test/oauth/authorize');
    }

    public function test_a_new_player_is_created_from_their_launcher_account(): void
    {
        $this->fakeLauncherLogin($this->launcherUser());

        $this->get(route('launcher.callback'))->assertRedirect(route('home'));

        $user = User::firstWhere('launcher_id', 7);
        $this->assertSame('Tijs', $user->name);
        $this->assertAuthenticatedAs($user);
        $this->assertFalse($user->isGuest());
    }

    public function test_the_launcher_token_is_kept_to_send_badges(): void
    {
        $launcherUser = $this->launcherUser();
        $launcherUser->token = 'player-token';
        $this->fakeLauncherLogin($launcherUser);

        $this->get(route('launcher.callback'));

        $this->assertSame('player-token', User::firstWhere('launcher_id', 7)->launcher_token);
    }

    public function test_long_first_names_are_cut_to_fit_the_game(): void
    {
        $this->fakeLauncherLogin($this->launcherUser(firstName: 'Maximiliaan-Alexander-Jozef'));

        $this->get(route('launcher.callback'));

        $this->assertSame(16, mb_strlen(User::firstWhere('launcher_id', 7)->name));
    }

    public function test_a_guest_keeps_their_history_when_linking_the_launcher(): void
    {
        $guest = $this->guest();
        $originalName = $guest->name;
        $this->fakeLauncherLogin($this->launcherUser());

        $this->actingAs($guest)->get(route('launcher.callback'))->assertRedirect(route('home'));

        $this->assertSame($guest->id, User::firstWhere('launcher_id', 7)->id);
        $this->assertSame($originalName, $guest->fresh()->name);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_a_returning_player_logs_back_into_the_same_account(): void
    {
        $user = User::factory()->create(['launcher_id' => 7, 'name' => 'Renamed', 'email' => null, 'password' => null]);
        $this->fakeLauncherLogin($this->launcherUser());

        $this->get(route('launcher.callback'));

        $this->assertAuthenticatedAs($user);
        $this->assertSame('Renamed', $user->fresh()->name);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_denying_access_returns_to_the_game_without_logging_in(): void
    {
        $this->get(route('launcher.callback', ['error' => 'access_denied']))->assertRedirect(route('home'));

        $this->assertGuest();
    }

    public function test_a_launcher_player_cannot_rename_themselves_in_the_game(): void
    {
        $user = User::factory()->create(['launcher_id' => 7, 'name' => 'Tijs', 'email' => null, 'password' => null]);

        $this->actingAs($user)
            ->patchJson(route('currentPlayer.update'), ['name' => 'Hacker', 'hat' => 'crown'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Tijs')
            ->assertJsonPath('data.hat', 'crown')
            ->assertJsonPath('data.is_launcher', true);
    }

    public function test_a_guest_is_not_a_launcher_player(): void
    {
        $this->actingAs($this->guest())
            ->getJson(route('currentPlayer.show'))
            ->assertJsonPath('data.is_launcher', false);
    }
}
