<?php

namespace App\Http\Resources;

use App\Models\Run;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaderboardResource extends JsonResource
{
    protected int $limit = 25;

    /** @param Builder<Run> $runs */
    public function __construct(
        protected Builder $runs,
        protected string $title,
    ) {
        parent::__construct(null);
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $bests = (clone $this->runs)->bestPerPlayer()->get();
        $players = User::with('character')->findMany($bests->pluck('user_id'))->keyBy('id');
        $me = $request->user();

        $entries = $bests->values()->map(fn (Run $best, int $index) => [
            'rank' => 1 + $bests->filter(fn (Run $other) => $other->best_score > $best->best_score)->count(),
            'player_id' => $best->user_id,
            'name' => $players[$best->user_id]?->name,
            'character' => $players[$best->user_id]?->character?->slug,
            'score' => (int) $best->best_score,
            'is_me' => $me?->id === $best->user_id,
        ]);

        return [
            'title' => $this->title,
            'entries' => $entries->take($this->limit)->values(),
            'me' => $entries->firstWhere('is_me', true),
        ];
    }
}
