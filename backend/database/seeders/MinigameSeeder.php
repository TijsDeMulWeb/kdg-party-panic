<?php

namespace Database\Seeders;

use App\Models\Minigame;
use Illuminate\Database\Seeder;

class MinigameSeeder extends Seeder
{
    /**
     * `max_score` is the highest score a perfect run can reach (see each
     * minigame's rules module in the client). Higher submissions are rejected.
     */
    public function run(): void
    {
        collect([
            ['slug' => 'color-crash', 'name' => 'Color Crash', 'duration_seconds' => 30, 'max_score' => 1050],
            ['slug' => 'package-panic', 'name' => 'Package Panic', 'duration_seconds' => 30, 'max_score' => 6000],
            ['slug' => 'big-ball', 'name' => 'Big Ball', 'duration_seconds' => 35, 'max_score' => 4500],
            ['slug' => 'vacuum-chaos', 'name' => 'Vacuum Chaos', 'duration_seconds' => 30, 'max_score' => 5000],
        ])->each(fn (array $minigame) => Minigame::updateOrCreate(['slug' => $minigame['slug']], $minigame));
    }
}
