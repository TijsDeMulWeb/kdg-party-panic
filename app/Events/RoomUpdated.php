<?php

namespace App\Events;

use App\Http\Resources\RoomResource;
use App\Models\Room;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Http\Request;

class RoomUpdated implements ShouldBroadcastNow
{
    public function __construct(
        public Room $room,
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel($this->room->channelName());
    }

    public function broadcastAs(): string
    {
        return 'room.updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['room' => (new RoomResource($this->room->fresh()))->toArray(new Request)];
    }
}
