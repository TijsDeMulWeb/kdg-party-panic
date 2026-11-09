<?php

namespace App\Actions\Matches;

use App\Models\MatchRound;

class ScheduleRound
{
    public function handle(MatchRound $round, int $delayMilliseconds): MatchRound
    {
        $startsAt = now()->addMilliseconds($delayMilliseconds);

        $round->update([
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addSeconds($round->minigame->duration_seconds),
        ]);

        return $round->load('minigame', 'partyMatch');
    }
}
