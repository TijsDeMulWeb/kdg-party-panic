<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One attempt at a minigame for the leaderboards. The server picks the
 * seed and start time, so a score can only be submitted for a run it
 * actually handed out.
 */
#[Fillable(['user_id', 'minigame_id', 'daily_challenge_id', 'seed', 'is_official', 'score', 'started_at', 'submitted_at'])]
class Run extends Model
{
    /** Extra time after the minigame's duration in which a score is still accepted. */
    public static int $submissionGraceSeconds = 90;

    protected function casts(): array
    {
        return [
            'is_official' => 'boolean',
            'started_at' => 'immutable_datetime',
            'submitted_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Minigame, $this> */
    public function minigame(): BelongsTo
    {
        return $this->belongsTo(Minigame::class);
    }

    /** @return BelongsTo<DailyChallenge, $this> */
    public function dailyChallenge(): BelongsTo
    {
        return $this->belongsTo(DailyChallenge::class);
    }

    /** @param Builder<Run> $query */
    public function scopeSubmitted(Builder $query): void
    {
        $query->whereNotNull('submitted_at');
    }

    /** Best score per player, highest first. @param Builder<Run> $query */
    public function scopeBestPerPlayer(Builder $query): void
    {
        $query->submitted()
            ->selectRaw('user_id, max(score) as best_score, min(submitted_at) as first_submitted_at')
            ->groupBy('user_id')
            ->orderByDesc('best_score')
            ->orderBy('first_submitted_at');
    }

    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    public function submissionDeadline(): CarbonImmutable
    {
        return $this->started_at->addSeconds($this->minigame->duration_seconds + static::$submissionGraceSeconds);
    }
}
