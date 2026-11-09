<?php

namespace App\Http\Controllers;

use App\Http\Resources\LeaderboardResource;
use App\Models\DailyChallenge;
use App\Models\Run;

class DailyChallengeLeaderboardController extends Controller
{
    /** Today's official scores: each player's first finished attempt. */
    public function __invoke(): LeaderboardResource
    {
        $challenge = DailyChallenge::today()->load('minigame');
        $runs = Run::where('daily_challenge_id', $challenge->id)->where('is_official', true);

        return new LeaderboardResource($runs, "Daily: {$challenge->minigame->name}");
    }
}
