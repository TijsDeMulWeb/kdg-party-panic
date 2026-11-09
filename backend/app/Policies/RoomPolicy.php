<?php

namespace App\Policies;

use App\Models\Room;
use App\Models\User;

class RoomPolicy
{
    public function create(User $user): bool
    {
        return true;
    }

    public function view(User $user, Room $room): bool
    {
        return $room->hasPlayer($user);
    }

    public function join(User $user, Room $room): bool
    {
        return ! $room->hasPlayer($user);
    }

    public function updateMembership(User $user, Room $room): bool
    {
        if (! $room->hasPlayer($user)) {
            return false;
        }

        return ! $room->isPlaying();
    }

    public function leave(User $user, Room $room): bool
    {
        return $room->hasPlayer($user);
    }

    public function start(User $user, Room $room): bool
    {
        return $room->isHostedBy($user);
    }
}
