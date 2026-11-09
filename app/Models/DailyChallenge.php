<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\UniqueConstraintViolationException;

#[Fillable(['date', 'minigame_id', 'seed'])]
class DailyChallenge extends Model
{
    protected function casts(): array
    {
        return [
            'date' => 'immutable_date',
        ];
    }

    /** @return BelongsTo<Minigame, $this> */
    public function minigame(): BelongsTo
    {
        return $this->belongsTo(Minigame::class);
    }

    /** @return HasMany<Run, $this> */
    public function runs(): HasMany
    {
        return $this->hasMany(Run::class);
    }

    /**
     * Today's challenge. Everyone gets the same minigame and seed, derived
     * from the date, so it can be created lazily by the first visitor.
     */
    public static function today(): self
    {
        $date = now()->toDateString();
        $existing = static::whereDate('date', $date)->first();

        if ($existing) {
            return $existing;
        }

        $minigames = Minigame::orderBy('id')->get();

        try {
            return static::create([
                'date' => $date,
                'minigame_id' => $minigames[crc32("minigame-{$date}") % $minigames->count()]->id,
                'seed' => crc32("seed-{$date}"),
            ]);
        } catch (UniqueConstraintViolationException) {
            return static::whereDate('date', $date)->firstOrFail();
        }
    }
}
