<?php

namespace App\Support;

use App\Models\Room;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Broadcast;
use Throwable;

/**
 * Asks Pusher (or Reverb, which speaks the same HTTP API) who is currently
 * subscribed to a room's presence channel. The only way the server learns
 * about disconnects without webhooks.
 */
class RoomPresence
{
    /** @return Collection<int, int>|null Null when presence cannot be determined. */
    public function connectedPlayerIds(Room $room): ?Collection
    {
        $broadcaster = Broadcast::connection();

        if (! $broadcaster instanceof PusherBroadcaster) {
            return null;
        }

        try {
            $response = $broadcaster->getPusher()->get("/channels/presence-{$room->channelName()}/users", [], true);
        } catch (Throwable) {
            return null;
        }

        return collect($response['users'] ?? [])->map(fn (array $user) => (int) $user['id']);
    }
}
