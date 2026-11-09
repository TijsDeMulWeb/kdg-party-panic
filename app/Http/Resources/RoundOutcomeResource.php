<?php

namespace App\Http\Resources;

use App\Models\MatchRound;
use App\Models\RoundResult;
use App\Support\MatchStandings;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A finished round: everyone's score, placement and points, plus the
 * tournament standings after it.
 *
 * @mixin MatchRound
 */
class RoundOutcomeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $match = $this->partyMatch;

        return [
            'round' => new MatchRoundResource($this->resource),
            'is_finished' => $this->isFinished(),
            'match_finished' => $match->finished_at !== null,
            'results' => $this->isFinished()
                ? $this->results()->get()->map(fn (RoundResult $result) => [
                    'player_id' => $result->user_id,
                    'score' => $result->score,
                    'placement' => $result->placement,
                    'points' => $result->points,
                ])->sortBy(fn (array $result) => $result['placement'] ?? 99)->values()
                : [],
            'standings' => app(MatchStandings::class)->for($match),
        ];
    }
}
