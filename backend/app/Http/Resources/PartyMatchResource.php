<?php

namespace App\Http\Resources;

use App\Models\MatchRound;
use App\Models\PartyMatch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PartyMatch */
class PartyMatchResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $rounds = $this->rounds()->with('minigame', 'partyMatch')->get();
        $currentRound = $rounds->first(fn (MatchRound $round) => ! $round->isFinished() && $round->starts_at !== null);

        return [
            'id' => $this->id,
            'is_finished' => $this->finished_at !== null,
            'minigames' => $rounds->map(fn (MatchRound $round) => $round->minigame->slug)->values(),
            'current_round' => $currentRound ? new MatchRoundResource($currentRound) : null,
        ];
    }
}
