<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['party_match_id', 'user_id', 'character_id', 'final_rank', 'total_points'])]
class MatchPlayer extends Model
{
    /** @return BelongsTo<PartyMatch, $this> */
    public function partyMatch(): BelongsTo
    {
        return $this->belongsTo(PartyMatch::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Character, $this> */
    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }
}
