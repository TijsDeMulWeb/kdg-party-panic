<?php

namespace App\Actions\Rooms;

use App\Events\RoomUpdated;
use App\Models\Character;
use App\Models\Room;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class JoinRoom
{
    public function __construct(
        protected PruneDisconnectedPlayers $pruneDisconnectedPlayers,
    ) {}

    public function handle(Room $room, User $user): Room
    {
        if ($room->isPlaying()) {
            throw ValidationException::withMessages(['room' => 'A round is being played. Try again in a moment.']);
        }

        if ($room->isFull()) {
            $this->pruneDisconnectedPlayers->handle($room);
        }

        if ($room->isFull()) {
            throw ValidationException::withMessages(['room' => 'This party is full.']);
        }

        $members = $room->players()->get();

        $room->players()->attach($user->id, [
            'seat' => $this->freeSeat($members->pluck('membership.seat')->all()),
            'character_id' => $this->freeCharacterId($user, $members->pluck('membership.character_id')->all()),
            'is_ready' => false,
        ]);

        broadcast(new RoomUpdated($room))->toOthers();

        return $room;
    }

    /** @param array<int, int> $takenSeats */
    protected function freeSeat(array $takenSeats): int
    {
        return collect(range(0, Room::$maxPlayers - 1))->first(fn (int $seat) => ! in_array($seat, $takenSeats, true));
    }

    /** @param array<int, int> $takenCharacterIds */
    protected function freeCharacterId(User $user, array $takenCharacterIds): int
    {
        if ($user->character_id !== null) {
            if (! in_array($user->character_id, $takenCharacterIds, true)) {
                return $user->character_id;
            }
        }

        return Character::whereNotIn('id', $takenCharacterIds)->orderBy('id')->value('id');
    }
}
