<?php

namespace App\Actions\Badges;

use App\Enums\Badge;
use App\Models\MatchRound;
use App\Models\RoundResult;
use App\Support\LauncherBadges;

/** Badge progress for the winners of a finished party round. Equal first places all count. */
class AwardRoundBadges
{
    public function __construct(
        protected LauncherBadges $badges,
    ) {}

    public function handle(MatchRound $round): void
    {
        $round->results()
            ->where('placement', 1)
            ->with('user')
            ->get()
            ->each(fn (RoundResult $result) => $this->badges->increment($result->user, Badge::RoundWinner));
    }
}
