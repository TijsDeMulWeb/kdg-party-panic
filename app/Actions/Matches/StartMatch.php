<?php

namespace App\Actions\Matches;

use App\Actions\Rooms\PruneDisconnectedPlayers;
use App\Events\RoomUpdated;
use App\Events\RoundStarting;
use App\Models\Minigame;
use App\Models\PartyMatch;
use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class StartMatch
{
    /** Time for every client to load the minigame, read the intro and count down. */
    protected int $leadTimeMilliseconds = 8000;

    public function __construct(
        protected PruneDisconnectedPlayers $pruneDisconnectedPlayers,
        protected ScheduleRound $scheduleRound,
    ) {}

    public function handle(Room $room): PartyMatch
    {
        if ($room->isPlaying()) {
            throw ValidationException::withMessages(['room' => 'A match is already being played.']);
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

        $match = $room->matches()->create();

        $players->each(fn (User $player) => $match->players()->create([
            'user_id' => $player->id,
            'character_id' => $player->membership->character_id,
        ]));

        $this->pickMinigames()->each(fn (Minigame $minigame, int $index) => $match->rounds()->create([
            'minigame_id' => $minigame->id,
            'number' => $index + 1,
            'seed' => random_int(0, 4294967295),
        ]));

        $room->players()->newPivotQuery()->update(['is_ready' => false]);

        $firstRound = $this->scheduleRound->handle($match->rounds()->first(), $this->leadTimeMilliseconds);

        broadcast(new RoundStarting($firstRound));
        broadcast(new RoomUpdated($room));

        return $match;
    }

    /**
     * Every minigame once, then random extras, never the same one twice in a row.
     *
     * @return Collection<int, Minigame>
     */
    protected function pickMinigames(): Collection
    {
        $minigames = Minigame::all();
        $picks = $minigames->shuffle();

        while ($picks->count() < PartyMatch::$roundCount) {
            $picks->push($minigames->reject(fn (Minigame $minigame) => $minigame->is($picks->last()))->random());
        }

        return $picks->take(PartyMatch::$roundCount)->values();
    }
}
