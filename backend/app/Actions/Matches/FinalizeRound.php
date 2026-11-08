<?php

namespace App\Actions\Matches;

use App\Events\RoomUpdated;
use App\Events\RoundFinished;
use App\Events\RoundStarting;
use App\Models\MatchPlayer;
use App\Models\MatchRound;
use App\Models\RoundResult;
use App\Support\MatchStandings;

/**
 * Turns scores into placements and tournament points, then schedules the
 * next round or ends the match. Runs when everyone still in the room has
 * reported, or when the submission window closes. Safe to call repeatedly.
 */
class FinalizeRound
{
    /** @var array<int, int> */
    protected array $pointsByPlacement = [1 => 10, 2 => 7, 3 => 5, 4 => 3];

    /** Results screen, standings and the next intro. */
    protected int $nextRoundDelayMilliseconds = 18000;

    public function __construct(
        protected ScheduleRound $scheduleRound,
        protected MatchStandings $standings,
    ) {}

    public function handle(MatchRound $round): bool
    {
        if (! $this->isDue($round)) {
            return false;
        }

        $claimed = MatchRound::whereKey($round->id)->whereNull('finished_at')->update(['finished_at' => now()]);

        if ($claimed === 0) {
            return false;
        }

        $round->refresh();
        $match = $round->partyMatch;

        $match->players->each(fn (MatchPlayer $player) => $round->results()->firstOrCreate(['user_id' => $player->user_id]));

        $this->assignPlacements($round);

        $match->players->each(fn (MatchPlayer $player) => $player->update([
            'total_points' => RoundResult::whereIn('match_round_id', $match->rounds()->select('id'))->where('user_id', $player->user_id)->sum('points'),
        ]));

        $nextRound = $match->rounds()->whereNull('starts_at')->first();

        if ($nextRound) {
            $this->scheduleRound->handle($nextRound, $this->nextRoundDelayMilliseconds);
        }

        if (! $nextRound) {
            $this->finishMatch($round);
        }

        broadcast(new RoundFinished($round->fresh()));

        if ($nextRound) {
            broadcast(new RoundStarting($nextRound->fresh()->load('minigame', 'partyMatch')));
        }

        return true;
    }

    protected function isDue(MatchRound $round): bool
    {
        if ($round->isFinished() || $round->ends_at === null) {
            return false;
        }

        if ($round->submissionWindowClosed()) {
            return true;
        }

        $room = $round->partyMatch->room;
        $stillPlaying = $room ? $room->players()->pluck('users.id') : collect();
        $submitted = $round->results()->whereNotNull('submitted_at')->pluck('user_id');

        if ($stillPlaying->isEmpty()) {
            return false;
        }

        return $stillPlaying->diff($submitted)->isEmpty();
    }

    /** Competition ranking: equal scores share a placement. Players who never reported get none. */
    protected function assignPlacements(MatchRound $round): void
    {
        $results = $round->results()->get();
        $submitted = $results->whereNotNull('submitted_at');

        $results->each(function (RoundResult $result) use ($submitted) {
            if ($result->submitted_at === null) {
                $result->update(['placement' => null, 'points' => 0]);

                return;
            }

            $placement = 1 + $submitted->filter(fn (RoundResult $other) => $other->score > $result->score)->count();

            $result->update([
                'placement' => $placement,
                'points' => $this->pointsByPlacement[$placement] ?? 0,
            ]);
        });
    }

    protected function finishMatch(MatchRound $round): void
    {
        $match = $round->partyMatch;
        $match->update(['finished_at' => now()]);

        $this->standings->for($match)->each(fn (array $row) => $match->players()
            ->where('user_id', $row['player_id'])
            ->update(['final_rank' => $row['rank']]));

        if ($match->room) {
            broadcast(new RoomUpdated($match->room));
        }
    }
}
