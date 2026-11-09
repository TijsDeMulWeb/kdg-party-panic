<?php

namespace App\Http\Resources;

use App\Models\MatchPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin MatchPlayer */
class MatchHistoryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'match_id' => $this->party_match_id,
            'played_at' => $this->partyMatch->finished_at?->toIso8601String(),
            'rank' => $this->final_rank,
            'points' => $this->total_points,
            'character' => $this->character->slug,
            'players' => $this->partyMatch->players->count(),
            'winner' => $this->partyMatch->players->firstWhere('final_rank', 1)?->user?->name,
        ];
    }
}
