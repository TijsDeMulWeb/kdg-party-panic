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
            'number' => $this->number,
            'minigame' => $this->minigame->slug,
            'seed' => $this->seed,
            'starts_at' => $this->starts_at->getTimestampMs(),
            'ends_at' => $this->ends_at->getTimestampMs(),
        ];
    }
}
