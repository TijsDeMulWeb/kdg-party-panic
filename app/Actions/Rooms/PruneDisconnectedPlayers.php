<?php

namespace App\Actions\Rooms;

use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\User;
use App\Support\RoomPresence;

/**
 * Removes members that are no longer subscribed to the room channel.
 * Members that joined or changed something in the last few seconds are
 * kept: they may simply not have finished connecting yet.
 */
class PruneDisconnectedPlayers
{
    protected int $graceSeconds = 15;

    public function __construct(
        protected RoomPresence $presence,
        protected LeaveRoom $leaveRoom,
    ) {}

    public function handle(Room $room): void
    {
        $connectedIds = $this->presence->connectedPlayerIds($room);

        if ($connectedIds === null) {
            return;
        }

        $disconnected = $room->players()
            ->whereNotIn('users.id', $connectedIds)
            ->wherePivot('updated_at', '<', now()->subSeconds($this->graceSeconds))
            ->get();

        if ($disconnected->isEmpty()) {
            return;
        }

        $disconnected->each(fn (User $player) => $this->leaveRoom->handle($room, $player, broadcast: false));

        if ($room->exists) {
            broadcast(new RoomUpdated($room));
        }
    }
}
