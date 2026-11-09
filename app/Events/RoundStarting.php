<?php

namespace App\Events;

use App\Http\Resources\MatchRoundResource;
use App\Models\MatchRound;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Http\Request;

class RoundStarting implements ShouldBroadcastNow
{
    public function __construct(
        public MatchRound $round,
    ) {}

    /** @return array<int, PresenceChannel> */
    public function broadcastOn(): array
    {
        $room = $this->round->partyMatch->room;

        return $room ? [new PresenceChannel($room->channelName())] : [];
    }

    public function broadcastAs(): string
    {
        return 'round.starting';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['round' => (new MatchRoundResource($this->round))->toArray(new Request)];
    }
}
