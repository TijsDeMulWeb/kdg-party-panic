<?php

namespace App\Http\Controllers;

use App\Http\Resources\LeaderboardResource;
use App\Models\Minigame;
use App\Models\Run;

class LeaderboardsController extends Controller
{
    /** All-time best score per player for one minigame (Solo Arcade runs only). */
    public function show(Minigame $minigame): LeaderboardResource
    {
        $runs = Run::where('minigame_id', $minigame->id)->whereNull('daily_challenge_id');

        return new LeaderboardResource($runs, $minigame->name);
    }
}
