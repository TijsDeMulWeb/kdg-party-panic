<?php

namespace Tests\Feature;

use App\Models\DailyChallenge;
use App\Models\Minigame;
use App\Models\Run;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaderboardsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_a_run_hands_out_a_server_seed_and_accepts_one_valid_score(): void
    {
        $player = $this->guest();

        $run = $this->actingAs($player)->postJson(route('runs.store', 'color-crash'))->assertCreated()->json('data');

        $this->actingAs($player)->patchJson(route('runs.update', $run['id']), ['score' => 1051])->assertJsonValidationErrors('score');
        $this->actingAs($player)->patchJson(route('runs.update', $run['id']), ['score' => 640])->assertOk()->assertJsonPath('data.rank', 1);
        $this->actingAs($player)->patchJson(route('runs.update', $run['id']), ['score' => 700])->assertJsonValidationErrors('score');
    }

    public function test_nobody_can_submit_someone_elses_run(): void
    {
        $run = $this->actingAs($this->guest())->postJson(route('runs.store', 'color-crash'))->json('data');

        $this->actingAs($this->guest())->patchJson(route('runs.update', $run['id']), ['score' => 10])->assertForbidden();
    }

    public function test_an_expired_run_is_rejected(): void
    {
        $player = $this->guest();
        $run = $this->actingAs($player)->postJson(route('runs.store', 'color-crash'))->json('data');

        $this->travel(30 + Run::$submissionGraceSeconds + 1)->seconds();

        $this->actingAs($player)->patchJson(route('runs.update', $run['id']), ['score' => 10])->assertJsonValidationErrors('score');
    }

    public function test_the_leaderboard_lists_each_players_best_score(): void
    {
        $ana = $this->guest();
        $bo = $this->guest('blu');

        $this->submitRun($ana, 'color-crash', 300);
        $this->submitRun($ana, 'color-crash', 800);
        $this->submitRun($bo, 'color-crash', 500);
        $this->submitRun($bo, 'big-ball', 4000);

        $this->actingAs($bo)
            ->getJson(route('leaderboards.show', 'color-crash'))
            ->assertOk()
            ->assertJsonCount(2, 'data.entries')
            ->assertJsonPath('data.entries.0.name', $ana->name)
            ->assertJsonPath('data.entries.0.score', 800)
            ->assertJsonPath('data.me.rank', 2);
    }

    public function test_only_the_first_daily_attempt_is_official(): void
    {
        $player = $this->guest();
        $challenge = DailyChallenge::today();

        $first = $this->actingAs($player)->postJson(route('dailyChallengeRuns.store'))->assertCreated()->json('data');
        $this->assertSame($challenge->seed, $first['seed']);
        $this->actingAs($player)->patchJson(route('runs.update', $first['id']), ['score' => 200])->assertJsonPath('data.is_official', true);

        $second = $this->actingAs($player)->postJson(route('dailyChallengeRuns.store'))->json('data');
        $this->actingAs($player)->patchJson(route('runs.update', $second['id']), ['score' => 900])->assertJsonPath('data.is_official', false);

        $this->actingAs($player)->getJson(route('dailyChallenge.show'))->assertJsonPath('data.official_score', 200)->assertJsonPath('data.attempts', 2);
        $this->getJson(route('dailyChallengeLeaderboard.show'))->assertJsonPath('data.entries.0.score', 200);
    }

    public function test_everyone_gets_the_same_daily_challenge(): void
    {
        $first = $this->getJson(route('dailyChallenge.show'))->json('data');
        $second = $this->actingAs($this->guest())->getJson(route('dailyChallenge.show'))->json('data');

        $this->assertSame($first['seed'], $second['seed']);
        $this->assertSame($first['minigame'], $second['minigame']);
        $this->assertContains($first['minigame'], Minigame::pluck('slug')->all());
    }

    protected function submitRun($player, string $minigame, int $score): void
    {
        $run = $this->actingAs($player)->postJson(route('runs.store', $minigame))->json('data');
        $this->actingAs($player)->patchJson(route('runs.update', $run['id']), ['score' => $score])->assertOk();
    }
}
