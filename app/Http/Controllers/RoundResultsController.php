<?php

namespace App\Http\Controllers;

use App\Actions\Matches\SubmitRoundResult;
use App\Http\Requests\StoreRoundResultRequest;
use App\Http\Resources\RoundOutcomeResource;
use App\Models\MatchRound;
use Illuminate\Http\JsonResponse;

class RoundResultsController extends Controller
{
    public function index(MatchRound $round): RoundOutcomeResource
    {
        return new RoundOutcomeResource($round);
    }

    public function store(StoreRoundResultRequest $request, MatchRound $round, SubmitRoundResult $submitRoundResult): JsonResponse
    {
        $submitRoundResult->handle($round, $request->user(), $request->integer('score'));

        return (new RoundOutcomeResource($round->fresh()))->response()->setStatusCode(201);
    }
}
