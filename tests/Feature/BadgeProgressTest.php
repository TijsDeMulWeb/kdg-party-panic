<?php

namespace Tests\Feature;

use App\Models\DailyChallenge;
use App\Models\MatchRound;
use App\Models\PartyMatch;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BadgeProgressTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutDefer();
        config(['services.launcher.url' => 'http://launcher.test']);
        Http::fake();
    }

    public function test_a_solo_run_sends_solo_badge_progress(): void
    {
        $player = $this->launcherPlayer();

        $this->submitRun($player, 'color-crash', 500);
        $this->submitRun($player, 'big-ball', 100);

        $this->assertBadgeSent('solo-debuut', []);
        $this->assertBadgeSent('arcade-veteraan', ['increment' => 1]);
        $this->assertBadgeSent('ontdekkingsreiziger', ['progress' => 2]);
        $this->assertBadgeNotSent('perfectionist');
        $this->assertBadgeNotSent('dagelijkse-uitdaging');
    }

    public function test_a_perfect_run_earns_the_perfectionist_badge(): void
    {
        $this->submitRun($this->launcherPlayer(), 'color-crash', 1050);

        $this->assertBadgeSent('perfectionist', []);
    }

    public function test_only_the_official_daily_attempt_counts_for_daily_badges(): void
    {
        $player = $this->launcherPlayer();

        foreach (range(1, 2) as $attempt) {
            $run = $this->actingAs($player)->postJson(route('dailyChallengeRuns.store'))->json('data');
            $this->actingAs($player)->patchJson(route('runs.update', $run['id']), ['score' => 10])->assertOk();
        }

        $this->assertNotNull(DailyChallenge::today());
        $this->assertSame(1, $this->sentTo('uitdagingsjager')->count());
        $this->assertBadgeSent('dagelijkse-uitdaging', []);
    }

    public function test_guests_send_nothing(): void
    {
        $this->submitRun($this->guest(), 'color-crash', 1050);

        Http::assertNothingSent();
    }

    public function test_a_finished_party_sends_round_and_match_badges(): void
    {
        $room = $this->readyRoom(2);
        [$host, $other] = [$room->host, $room->players->firstWhere('id', '!=', $room->host_id)];
        collect([$host, $other])->each(fn (User $player) => $this->giveLauncherAccount($player));

        $this->actingAs($host)->postJson(route('matches.store', $room))->assertCreated();
        $match = PartyMatch::firstOrFail();

        foreach (range(1, 5) as $number) {
            $round = MatchRound::where('number', $number)->firstOrFail();
            $this->travelTo($round->ends_at);
            $this->actingAs($host)->postJson(route('roundResults.store', $round), ['score' => $number === 3 ? 0 : 200])->assertCreated();
            $this->actingAs($other)->postJson(route('roundResults.store', $round), ['score' => 100])->assertCreated();
        }

        $this->assertNotNull($match->fresh()->finished_at);
        $this->assertSame(4, $this->sentTo('rondewinnaar', 'host-token')->count());
        $this->assertSame(1, $this->sentTo('rondewinnaar', 'other-token')->count());
        $this->assertSame(1, $this->sentTo('feestbeest', 'other-token')->count());
        $this->assertSame(1, $this->sentTo('eerste-feest', 'other-token')->count());
        $this->assertSame(1, $this->sentTo('kampioen', 'host-token')->count());
        $this->assertSame(1, $this->sentTo('onverslaanbaar', 'host-token')->count());
        $this->assertSame(0, $this->sentTo('kampioen', 'other-token')->count());
    }

    protected function launcherPlayer(): User
    {
        return $this->giveLauncherAccount($this->guest());
    }

    protected function giveLauncherAccount(User $user): User
    {
        $user->launcher_id = $user->id;
        $user->launcher_token = $user->character->slug === 'pip' ? 'host-token' : 'other-token';
        $user->save();

        return $user;
    }

    protected function submitRun(User $player, string $minigame, int $score): void
    {
        $run = $this->actingAs($player)->postJson(route('runs.store', $minigame))->json('data');
        $this->actingAs($player)->patchJson(route('runs.update', $run['id']), ['score' => $score])->assertOk();
    }

    protected function readyRoom(int $players): Room
    {
        $room = $this->roomWithPlayers($players);
        $room->players()->newPivotQuery()->update(['is_ready' => true]);

        return $room->fresh();
    }

    /** @param array<string, int> $data */
    protected function assertBadgeSent(string $key, array $data): void
    {
        Http::assertSent(fn (Request $request) => $request->method() === 'PUT'
            && $request->url() === "http://launcher.test/api/badges/{$key}"
            && $request->data() === $data);
    }

    protected function assertBadgeNotSent(string $key): void
    {
        $this->assertSame(0, $this->sentTo($key)->count());
    }

    /** @return Collection<int, array{0: Request, 1: mixed}> */
    protected function sentTo(string $key, ?string $token = null): Collection
    {
        return Http::recorded(fn (Request $request) => $request->url() === "http://launcher.test/api/badges/{$key}"
            && ($token === null || $request->hasHeader('Authorization', "Bearer {$token}")));
    }
}
