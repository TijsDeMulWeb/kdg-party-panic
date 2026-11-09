<?php

namespace App\Policies;

use App\Models\MatchRound;
use App\Models\User;

class MatchRoundPolicy
{
    public function view(User $user, MatchRound $round): bool
    {
        return $round->partyMatch->players()->where('user_id', $user->id)->exists();
    }

    public function submitResult(User $user, MatchRound $round): bool
    {
        return $this->view($user, $round);
    }
}
