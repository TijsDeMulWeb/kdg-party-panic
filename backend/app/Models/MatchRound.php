<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['room_id', 'minigame_id', 'number', 'seed', 'starts_at', 'ends_at'])]
class MatchRound extends Model
{
    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** @return BelongsTo<Minigame, $this> */
    public function minigame(): BelongsTo
    {
        return $this->belongsTo(Minigame::class);
    }

    /** @param Builder<MatchRound> $query */
    public function scopeInProgress(Builder $query): void
    {
        $query->where('ends_at', '>', now());
    }
}
