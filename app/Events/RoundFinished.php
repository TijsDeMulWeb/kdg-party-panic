<?php

namespace App\Events;

use App\Http\Resources\RoundOutcomeResource;
use App\Models\MatchRound;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Http\Request;

class RoundFinished implements ShouldBroadcastNow
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
        return 'round.finished';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['outcome' => (new RoundOutcomeResource($this->round))->resolve(new Request)];
    }
}
