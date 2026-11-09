<?php

namespace App\Actions\Matches;

use App\Models\MatchRound;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class SubmitRoundResult
{
    public function __construct(
        protected FinalizeRound $finalizeRound,
    ) {}

    public function handle(MatchRound $round, User $user, int $score): void
    {
        if (! $round->acceptsResults()) {
            throw ValidationException::withMessages(['score' => 'This round is not accepting results.']);
        }

        if ($score > $round->minigame->max_score) {
            throw ValidationException::withMessages(['score' => 'That score is not possible in this minigame.']);
        }

        $result = $round->results()->firstOrNew(['user_id' => $user->id]);

        if ($result->submitted_at !== null) {
            throw ValidationException::withMessages(['score' => 'You already reported a score for this round.']);
        }

        $result->fill(['score' => $score, 'submitted_at' => now()])->save();

        $this->finalizeRound->handle($round);
    }
}
