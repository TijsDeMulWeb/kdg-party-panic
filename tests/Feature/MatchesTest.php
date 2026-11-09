<?php

namespace Tests\Feature;

use App\Events\RoundFinished;
use App\Events\RoundStarting;
use App\Models\MatchRound;
use App\Models\PartyMatch;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class MatchesTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_only_the_host_can_start_a_match(): void
    {
        $room = $this->readyRoom(2);
        $otherPlayer = $room->players->firstWhere('id', '!=', $room->host_id);

        $this->actingAs($otherPlayer)->postJson(route('matches.store', $room))->assertForbidden();
    }

    public function test_a_match_needs_two_ready_players(): void
    {
        $soloRoom = $this->readyRoom(1);
        $this->actingAs($soloRoom->host)->postJson(route('matches.store', $soloRoom))->assertUnprocessable();

        $room = $this->roomWithPlayers(2);
        $this->actingAs($room->host)->postJson(route('matches.store', $room))->assertJsonValidationErrors('room');
    }

    public function test_starting_a_match_plans_five_rounds_and_schedules_the_first(): void
    {
        Event::fake([RoundStarting::class]);
        $room = $this->readyRoom(3);

        $this->actingAs($room->host)->postJson(route('matches.store', $room))->assertCreated()->assertJsonCount(5, 'data.minigames');

        $match = PartyMatch::firstOrFail();
        $rounds = $match->rounds;

        $this->assertCount(5, $rounds);
        $this->assertCount(5, $rounds->pluck('minigame_id')->unique());
        $this->assertNotNull($rounds[0]->starts_at);
        $this->assertNull($rounds[1]->starts_at);
        $this->assertCount(3, $match->players);
        $this->assertTrue($room->isPlaying());
        $rounds->sliding(2)->each(fn ($pair) => $this->assertNotSame($pair->first()->minigame_id, $pair->last()->minigame_id));
        Event::assertDispatched(RoundStarting::class);
    }

    public function test_results_are_only_accepted_once_the_round_started_and_within_the_score_limit(): void
    {
        [$room, $round] = $this->startedMatch(2);

        $this->actingAs($room->host)->postJson(route('roundResults.store', $round), ['score' => 100])->assertJsonValidationErrors('score');

        $this->travelTo($round->starts_at);

        $this->actingAs($room->host)
            ->postJson(route('roundResults.store', $round), ['score' => $round->minigame->max_score + 1])
            ->assertJsonValidationErrors('score');

        $this->actingAs($room->host)->postJson(route('roundResults.store', $round), ['score' => 300])->assertCreated();
        $this->actingAs($room->host)->postJson(route('roundResults.store', $round), ['score' => 400])->assertJsonValidationErrors('score');
    }

    public function test_outsiders_cannot_report_a_score(): void
    {
        [, $round] = $this->startedMatch(2);
        $this->travelTo($round->ends_at);

        $this->actingAs($this->guest())->postJson(route('roundResults.store', $round), ['score' => 10])->assertForbidden();
    }

    public function test_a_round_ends_early_once_everyone_reported(): void
    {
        [$room, $round] = $this->startedMatch(2);
        [$host, $guest] = $room->players;

        $this->travelTo($round->starts_at->addSeconds(5));

        $this->actingAs($host)->postJson(route('roundResults.store', $round), ['score' => 100])->assertCreated();
        $this->actingAs($guest)->postJson(route('roundResults.store', $round), ['score' => 50])->assertCreated();

        $this->assertNotNull($round->fresh()->finished_at);
    }

    public function test_the_round_is_scored_once_everyone_reported(): void
    {
        Event::fake([RoundFinished::class, RoundStarting::class]);
        [$room, $round] = $this->startedMatch(4);
        $this->travelTo($round->ends_at);

        $scores = [500, 900, 500, 100];
        $room->players->values()->each(fn ($player, $index) => $this->actingAs($player)
            ->postJson(route('roundResults.store', $round), ['score' => $scores[$index]])
            ->assertCreated());

        $round->refresh();
        $this->assertTrue($round->isFinished());

        $points = $round->results()->get()->mapWithKeys(fn ($result) => [$result->score => [$result->placement, $result->points]]);
        $this->assertSame([1, 10], $points[900]);
        $this->assertSame([2, 7], $points[500]);
        $this->assertSame([4, 3], $points[100]);

        $this->assertNotNull($round->partyMatch->rounds()->where('number', 2)->value('starts_at'));
        Event::assertDispatched(RoundFinished::class);
        Event::assertDispatchedTimes(RoundStarting::class, 2);
    }

    public function test_a_round_finishes_without_missing_players_once_the_window_closes(): void
    {
        [$room, $round] = $this->startedMatch(2);
        $this->travelTo($round->ends_at);
        $this->actingAs($room->host)->postJson(route('roundResults.store', $round), ['score' => 50])->assertCreated();

        $this->actingAs($room->host)->postJson(route('roundFinalization.store', $round))->assertOk()->assertJsonPath('data.is_finished', false);

        $this->travelTo($round->ends_at->addSeconds(MatchRound::$submissionGraceSeconds));

        $this->actingAs($room->host)
            ->postJson(route('roundFinalization.store', $round))
            ->assertOk()
            ->assertJsonPath('data.is_finished', true)
            ->assertJsonPath('data.results.0.player_id', $room->host_id)
            ->assertJsonPath('data.results.0.points', 10)
            ->assertJsonPath('data.results.1.placement', null)
            ->assertJsonPath('data.results.1.points', 0);
    }

    public function test_the_match_ends_after_five_rounds_with_final_standings(): void
    {
        [$room] = $this->startedMatch(2);
        $match = PartyMatch::firstOrFail();
        [$host, $other] = [$room->host, $room->players->firstWhere('id', '!=', $room->host_id)];

        foreach (range(1, 5) as $number) {
            $round = $match->rounds()->where('number', $number)->first();
            $this->travelTo($round->ends_at);
            $this->actingAs($host)->postJson(route('roundResults.store', $round), ['score' => $number === 3 ? 0 : 200])->assertCreated();
            $this->actingAs($other)->postJson(route('roundResults.store', $round), ['score' => 100])->assertCreated();
        }

        $match->refresh();
        $this->assertNotNull($match->finished_at);
        $this->assertFalse($room->isPlaying());
        $this->assertSame(1, $match->players()->where('user_id', $host->id)->value('final_rank'));
        $this->assertSame(47, $match->players()->where('user_id', $host->id)->value('total_points'));

        $this->actingAs($host)
            ->getJson(route('matchHistory.index'))
            ->assertOk()
            ->assertJsonPath('data.0.rank', 1)
            ->assertJsonPath('data.0.points', 47)
            ->assertJsonPath('data.0.winner', $host->name);
    }

    protected function readyRoom(int $players): Room
    {
        $room = $this->roomWithPlayers($players);
        $room->players()->newPivotQuery()->update(['is_ready' => true]);

        return $room;
    }

    /** @return array{0: Room, 1: MatchRound} */
    protected function startedMatch(int $players): array
    {
        $room = $this->readyRoom($players);
        $this->actingAs($room->host)->postJson(route('matches.store', $room))->assertCreated();

        return [$room->fresh(), MatchRound::where('number', 1)->firstOrFail()];
    }
}
