<?php

namespace App\Models;

use Database\Factories\RoomFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'host_id'])]
class Room extends Model
{
    /** @use HasFactory<RoomFactory> */
    use HasFactory;

    public static int $maxPlayers = 4;

    public static int $minPlayersToStart = 2;

    public function channelName(): string
    {
        return "room.{$this->code}";
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /** @return BelongsTo<User, $this> */
    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    /** @return BelongsToMany<User, $this, RoomMember, 'membership'> */
    public function players(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->using(RoomMember::class)
            ->as('membership')
            ->withPivot(['id', 'seat', 'is_ready', 'character_id'])
            ->withTimestamps()
            ->orderByPivot('seat');
    }

    /** @return HasMany<MatchRound, $this> */
    public function rounds(): HasMany
    {
        return $this->hasMany(MatchRound::class);
    }

    public function hasPlayer(User $user): bool
    {
        return $this->players()->whereKey($user->id)->exists();
    }

    public function isFull(): bool
    {
        return $this->players()->count() >= static::$maxPlayers;
    }

    public function isPlaying(): bool
    {
        return $this->rounds()->inProgress()->exists();
    }

    public function isHostedBy(User $user): bool
    {
        return $this->host_id === $user->id;
    }
}
