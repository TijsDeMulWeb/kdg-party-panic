<?php

namespace App\Actions\Rooms;

use App\Events\RoomUpdated;
use App\Events\RoundStarting;
use App\Models\MatchRound;
use App\Models\Minigame;
use App\Models\Room;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class StartRound
{
    /** Time for every client to load the minigame, read the intro and count down. */
    protected int $leadTimeMilliseconds = 8000;

    public function __construct(
        protected PruneDisconnectedPlayers $pruneDisconnectedPlayers,
    ) {}

    public function handle(Room $room): MatchRound
    {
        if ($room->isPlaying()) {
            throw ValidationException::withMessages(['room' => 'A round is already being played.']);
        }

        $this->pruneDisconnectedPlayers->handle($room);

        $players = $room->players()->get();

        if ($players->count() < Room::$minPlayersToStart) {
            $minimum = Room::$minPlayersToStart;

            throw ValidationException::withMessages(['room' => "You need at least {$minimum} players."]);
        }

        if ($players->contains(fn (User $player) => ! $player->membership->is_ready)) {
            throw ValidationException::withMessages(['room' => 'Not everyone is ready yet.']);
        }

        $minigame = Minigame::where('slug', 'color-crash')->firstOrFail();
        $startsAt = now()->addMilliseconds($this->leadTimeMilliseconds);

        $round = $room->rounds()->create([
            'minigame_id' => $minigame->id,
            'number' => $room->rounds()->count() + 1,
            'seed' => random_int(0, 4294967295),
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addSeconds($minigame->duration_seconds),
        ]);

        $room->players()->newPivotQuery()->update(['is_ready' => false]);

        broadcast(new RoundStarting($round->load('minigame', 'room')));
        broadcast(new RoomUpdated($room));

        return $round;
    }
}
