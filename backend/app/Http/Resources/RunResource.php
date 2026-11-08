<?php

namespace App\Http\Resources;

use App\Models\Run;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Run */
class RunResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'minigame' => $this->minigame->slug,
            'seed' => $this->seed,
            'is_daily' => $this->daily_challenge_id !== null,
            'is_official' => $this->is_official,
            'score' => $this->score,
            'rank' => $this->when($this->isSubmitted(), fn () => $this->rank()),
        ];
    }

    /** Position of this score among each player's best (ties share a rank). */
    protected function rank(): int
    {
        $query = Run::where('minigame_id', $this->minigame_id);

        if ($this->daily_challenge_id === null) {
            $query->whereNull('daily_challenge_id');
        }

        if ($this->daily_challenge_id !== null) {
            $query->where('daily_challenge_id', $this->daily_challenge_id)->where('is_official', true);
        }

        $better = $query->bestPerPlayer()->get()->filter(fn (Run $best) => $best->best_score > $this->score && $best->user_id !== $this->user_id);

        return $better->count() + 1;
    }
}
