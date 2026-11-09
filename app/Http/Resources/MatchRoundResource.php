<?php

namespace App\Http\Resources;

use App\Models\MatchRound;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin MatchRound */
class MatchRoundResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'match_id' => $this->party_match_id,
            'number' => $this->number,
            'total_rounds' => $this->partyMatch->rounds()->count(),
            'minigame' => $this->minigame->slug,
            'seed' => $this->seed,
            'starts_at' => $this->starts_at?->getTimestampMs(),
            'ends_at' => $this->ends_at?->getTimestampMs(),
            'is_finished' => $this->isFinished(),
        ];
    }
}
