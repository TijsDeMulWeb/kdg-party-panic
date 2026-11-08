<?php

namespace App\Policies;

use App\Models\Run;
use App\Models\User;

class RunPolicy
{
    public function update(User $user, Run $run): bool
    {
        return $run->user_id === $user->id;
    }
}
