<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['room_id', 'finished_at'])]
class PartyMatch extends Model
{
    public static int $roundCount = 5;

    protected function casts(): array
    {
        return [
            'finished_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** @return HasMany<MatchRound, $this> */
    public function rounds(): HasMany
    {
        return $this->hasMany(MatchRound::class)->orderBy('number');
    }

    /** @return HasMany<MatchPlayer, $this> */
    public function players(): HasMany
    {
        return $this->hasMany(MatchPlayer::class);
    }

    /** @param Builder<PartyMatch> $query */
    public function scopeInProgress(Builder $query): void
    {
        $query->whereNull('finished_at');
    }
}
