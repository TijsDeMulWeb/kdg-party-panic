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
            ['slug' => 'snowball-splat', 'name' => 'Snowball Splat', 'duration_seconds' => 30, 'max_score' => 3000],
            ['slug' => 'quick-draw', 'name' => 'Quick Draw', 'duration_seconds' => 30, 'max_score' => 1500],
            ['slug' => 'ice-slide', 'name' => 'Ice Slide', 'duration_seconds' => 35, 'max_score' => 1500],
            ['slug' => 'kart-race', 'name' => 'Mini Kart Race', 'duration_seconds' => 45, 'max_score' => 2400],
            ['slug' => 'hot-potato', 'name' => 'Hot Potato', 'duration_seconds' => 30, 'max_score' => 750],
        ])->each(fn (array $minigame) => Minigame::updateOrCreate(['slug' => $minigame['slug']], $minigame));
    }
}
