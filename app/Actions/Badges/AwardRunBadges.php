<?php

namespace App\Actions\Badges;

use App\Enums\Badge;
use App\Models\Run;
use App\Support\LauncherBadges;

/** Badge progress for a submitted solo or daily challenge run. */
class AwardRunBadges
{
    public function __construct(
        protected LauncherBadges $badges,
    ) {}

    public function handle(Run $run): void
    {
        $user = $run->user;

        if (! $user->launcher_token) {
            return;
        }

        $this->badges->earn($user, Badge::SoloDebut);
        $this->badges->increment($user, Badge::ArcadeVeteran);
        $this->badges->setProgress($user, Badge::Explorer, $user->runs()->submitted()->distinct()->count('minigame_id'));

        if ($run->score >= $run->minigame->max_score) {
            $this->badges->earn($user, Badge::Perfectionist);
        }

        if ($run->is_official) {
            $this->badges->earn($user, Badge::DailyChallenge);
            $this->badges->increment($user, Badge::ChallengeHunter);
        }
    }
}
