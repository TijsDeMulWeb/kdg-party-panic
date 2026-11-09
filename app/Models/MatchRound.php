<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['party_match_id', 'minigame_id', 'number', 'seed', 'starts_at', 'ends_at', 'finished_at'])]
class MatchRound extends Model
{
    /** Players have this long after the final whistle to report their score. */
    public static int $submissionGraceSeconds = 4;

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'finished_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<PartyMatch, $this> */
    public function partyMatch(): BelongsTo
    {
        return $this->belongsTo(PartyMatch::class);
    }

    /** @return BelongsTo<Minigame, $this> */
    public function minigame(): BelongsTo
    {
        return $this->belongsTo(Minigame::class);
    }

    /** @return HasMany<RoundResult, $this> */
    public function results(): HasMany
    {
        return $this->hasMany(RoundResult::class);
    }

    public function isFinished(): bool
    {
        return $this->finished_at !== null;
    }

    public function acceptsResults(): bool
    {
        if ($this->isFinished() || $this->starts_at === null) {
            return false;
        }

        // Early results are fine: when everyone is out, the round ends before the timer does.
        return now()->greaterThanOrEqualTo($this->starts_at);
    }

    public function submissionWindowClosed(): bool
    {
        return $this->ends_at !== null && now()->greaterThanOrEqualTo($this->ends_at->addSeconds(static::$submissionGraceSeconds));
    }
}
