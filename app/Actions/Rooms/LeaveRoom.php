<?php

namespace App\Actions\Rooms;

use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\User;

class LeaveRoom
{
    public function handle(Room $room, User $user, bool $broadcast = true): void
    {
        $room->players()->detach($user->id);

        $nextHost = $room->players()->first();

        if (! $nextHost) {
            $room->delete();

            return;
        }

        if ($room->isHostedBy($user)) {
            $room->update(['host_id' => $nextHost->id]);
        }

        if ($broadcast) {
            broadcast(new RoomUpdated($room));
        }
    }
}
