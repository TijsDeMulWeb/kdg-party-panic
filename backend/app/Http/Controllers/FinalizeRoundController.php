<?php

namespace App\Http\Controllers;

use App\Actions\Matches\FinalizeRound;
use App\Http\Resources\RoundOutcomeResource;
use App\Models\MatchRound;

/**
 * Clients call this once the submission window has passed, so a round
 * still finishes when a player never reports. Idempotent.
 */
class FinalizeRoundController extends Controller
{
    public function __invoke(MatchRound $round, FinalizeRound $finalizeRound): RoundOutcomeResource
    {
        $finalizeRound->handle($round);

        return new RoundOutcomeResource($round->fresh());
    }
}
