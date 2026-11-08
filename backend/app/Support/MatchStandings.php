<?php

namespace App\Support;

use App\Models\MatchPlayer;
use App\Models\PartyMatch;
use App\Models\RoundResult;
use Illuminate\Support\Collection;

/** Tournament table: total points, then total score as tie-breaker. */
class MatchStandings
{
    /** @return Collection<int, array{player_id: int, name: string, character: string, total_points: int, total_score: int, rank: int}> */
    public function for(PartyMatch $match): Collection
    {
        $scoreTotals = RoundResult::whereIn('match_round_id', $match->rounds()->select('id'))
            ->selectRaw('user_id, sum(score) as total_score')
            ->groupBy('user_id')
            ->pluck('total_score', 'user_id');

        $rows = $match->players()->with('user', 'character')->get()
            ->map(fn (MatchPlayer $player) => [
                'player_id' => $player->user_id,
                'name' => $player->user->name,
                'character' => $player->character->slug,
                'total_points' => (int) $player->total_points,
                'total_score' => (int) ($scoreTotals[$player->user_id] ?? 0),
            ])
            ->sortBy([['total_points', 'desc'], ['total_score', 'desc']])
            ->values();

        return $rows->map(fn (array $row) => [
            ...$row,
            'rank' => 1 + $rows->filter(fn (array $other) => $this->isAhead($other, $row))->count(),
        ]);
    }

    /**
     * @param  array{total_points: int, total_score: int}  $other
     * @param  array{total_points: int, total_score: int}  $row
     */
    protected function isAhead(array $other, array $row): bool
    {
        if ($other['total_points'] !== $row['total_points']) {
            return $other['total_points'] > $row['total_points'];
        }

        return $other['total_score'] > $row['total_score'];
    }
}
