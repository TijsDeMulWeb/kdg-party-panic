<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['slug', 'name', 'duration_seconds', 'max_score'])]
class Minigame extends Model
{
    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
