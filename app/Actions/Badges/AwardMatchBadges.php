<?php

namespace App\Actions\Badges;

use App\Enums\Badge;
use App\Models\MatchPlayer;
use App\Models\PartyMatch;
use App\Support\LauncherBadges;

/** Badge progress for everyone who played a party to the end, and extra badges for the winners. */
class AwardMatchBadges
{
    public function __construct(
        protected LauncherBadges $badges,
    ) {}

    public function handle(PartyMatch $match): void
    {
        $match->players()->with('user')->get()->each(function (MatchPlayer $player) {
            $this->badges->earn($player->user, Badge::FirstParty);
            $this->badges->increment($player->user, Badge::PartyAnimal);

            if ($player->final_rank === 1) {
                $this->badges->earn($player->user, Badge::Champion);
                $this->badges->increment($player->user, Badge::Unbeatable);
            }
        });
    }
}
