<?php

namespace App\Http\Resources;

use App\Models\Character;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Room */
class RoomResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $characterSlugs = Character::pluck('slug', 'id');
        $activeMatch = $this->activeMatch();

        return [
            'code' => $this->code,
            'host_id' => $this->host_id,
            'max_players' => Room::$maxPlayers,
            'min_players' => Room::$minPlayersToStart,
            'active_match' => $activeMatch ? new PartyMatchResource($activeMatch) : null,
            'players' => $this->players->map(fn (User $player) => [
                'id' => $player->id,
                'name' => $player->name,
                'seat' => $player->membership->seat,
                'is_ready' => $player->membership->is_ready,
                'character' => $characterSlugs[$player->membership->character_id] ?? null,
                'hat' => $player->hat?->slug,
            ])->values(),
        ];
    }
}
