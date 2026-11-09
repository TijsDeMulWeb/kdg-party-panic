<?php

namespace App\Http\Controllers;

use App\Http\Resources\RunResource;
use App\Models\DailyChallenge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DailyChallengeRunsController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $challenge = DailyChallenge::today();

        $run = $request->user()->runs()->create([
            'minigame_id' => $challenge->minigame_id,
            'daily_challenge_id' => $challenge->id,
            'seed' => $challenge->seed,
            'started_at' => now(),
        ]);

        return (new RunResource($run->load('minigame')))->response()->setStatusCode(201);
    }
}
