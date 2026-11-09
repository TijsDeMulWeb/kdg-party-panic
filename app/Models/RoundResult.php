<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['match_round_id', 'user_id', 'score', 'placement', 'points', 'submitted_at'])]
class RoundResult extends Model
{
    protected function casts(): array
    {
        return [
            'submitted_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<MatchRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(MatchRound::class, 'match_round_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
