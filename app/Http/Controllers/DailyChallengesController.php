<?php

namespace App\Http\Controllers;

use App\Http\Resources\DailyChallengeResource;
use App\Models\DailyChallenge;

class DailyChallengesController extends Controller
{
    public function show(): DailyChallengeResource
    {
        return new DailyChallengeResource(DailyChallenge::today()->load('minigame'));
    }
}
