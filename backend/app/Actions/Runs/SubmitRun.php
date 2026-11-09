<?php

namespace App\Actions\Runs;

use App\Models\Run;
use Illuminate\Validation\ValidationException;

/**
 * Validates a leaderboard score: it must belong to a run the server handed
 * out, arrive in time, be submitted once and be achievable in the minigame.
 * For the daily challenge only the first finished run counts.
 */
class SubmitRun
{
    public function handle(Run $run, int $score): Run
    {
        $run->loadMissing('minigame');

        if ($run->isSubmitted()) {
            throw ValidationException::withMessages(['score' => 'This run already has a score.']);
        }

        if (now()->greaterThan($run->submissionDeadline())) {
            throw ValidationException::withMessages(['score' => 'This run has expired.']);
        }

        if ($score > $run->minigame->max_score) {
            throw ValidationException::withMessages(['score' => 'That score is not possible in this minigame.']);
        }

        $run->fill([
            'score' => $score,
            'submitted_at' => now(),
            'is_official' => $this->isFirstDailyAttempt($run),
        ])->save();

        return $run;
    }

    protected function isFirstDailyAttempt(Run $run): bool
    {
        if ($run->daily_challenge_id === null) {
            return false;
        }

        return ! Run::where('daily_challenge_id', $run->daily_challenge_id)
            ->where('user_id', $run->user_id)
            ->where('is_official', true)
            ->exists();
    }
}
