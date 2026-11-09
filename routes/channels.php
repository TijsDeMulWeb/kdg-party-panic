<?php

use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('room.{room}', function (User $user, Room $room) {
    if (! $room->hasPlayer($user)) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
    ];
});
