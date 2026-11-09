<?php

namespace App\Http\Resources;

use App\Models\DailyChallenge;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DailyChallenge */
class DailyChallengeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $myRuns = $user ? $this->runs()->where('user_id', $user->id)->submitted() : null;

        return [
            'date' => $this->date->toDateString(),
            'minigame' => $this->minigame->slug,
            'seed' => $this->seed,
            'official_score' => $myRuns ? (clone $myRuns)->where('is_official', true)->value('score') : null,
            'attempts' => $myRuns ? $myRuns->count() : 0,
            'rules' => 'Your first finished attempt is your official score. Later attempts are practice and do not change the leaderboard.',
            'resets_at' => now()->endOfDay()->getTimestampMs(),
        ];
    }
}
