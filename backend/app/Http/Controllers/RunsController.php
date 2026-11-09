<?php

namespace App\Http\Controllers;

use App\Actions\Runs\SubmitRun;
use App\Http\Requests\UpdateRunRequest;
use App\Http\Resources\RunResource;
use App\Models\Minigame;
use App\Models\Run;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RunsController extends Controller
{
    /** Hands out a server-chosen seed for a Solo Arcade attempt. */
    public function store(Request $request, Minigame $minigame): JsonResponse
    {
        $run = $request->user()->runs()->create([
            'minigame_id' => $minigame->id,
            'seed' => random_int(0, 4294967295),
            'started_at' => now(),
        ]);

        return (new RunResource($run->load('minigame')))->response()->setStatusCode(201);
    }

    public function update(UpdateRunRequest $request, Run $run, SubmitRun $submitRun): RunResource
    {
        return new RunResource($submitRun->handle($run, $request->integer('score')));
    }
}
