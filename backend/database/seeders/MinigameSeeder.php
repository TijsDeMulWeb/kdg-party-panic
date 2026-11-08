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
            ['slug' => 'package-panic', 'name' => 'Package Panic', 'duration_seconds' => 30, 'max_score' => 4000],
            ['slug' => 'big-ball', 'name' => 'Big Ball', 'duration_seconds' => 35, 'max_score' => 4500],
            ['slug' => 'vacuum-chaos', 'name' => 'Vacuum Chaos', 'duration_seconds' => 30, 'max_score' => 2300],
            ['slug' => 'paint-party', 'name' => 'Paint Party', 'duration_seconds' => 30, 'max_score' => 1440],
            ['slug' => 'meteor-mayhem', 'name' => 'Meteor Mayhem', 'duration_seconds' => 30, 'max_score' => 1200],
            ['slug' => 'sky-tower', 'name' => 'Sky Tower', 'duration_seconds' => 35, 'max_score' => 1650],
            ['slug' => 'fruit-frenzy', 'name' => 'Fruit Frenzy', 'duration_seconds' => 30, 'max_score' => 1400],
            ['slug' => 'bumper-sumo', 'name' => 'Bumper Sumo', 'duration_seconds' => 30, 'max_score' => 1100],
        ])->each(fn (array $minigame) => Minigame::updateOrCreate(['slug' => $minigame['slug']], $minigame));
    }
}
