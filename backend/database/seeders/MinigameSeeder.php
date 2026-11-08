<?php

namespace Database\Seeders;

use App\Models\Minigame;
use Illuminate\Database\Seeder;

class MinigameSeeder extends Seeder
{
    public function run(): void
    {
        Minigame::updateOrCreate(['slug' => 'color-crash'], ['name' => 'Color Crash', 'duration_seconds' => 30]);
    }
}
