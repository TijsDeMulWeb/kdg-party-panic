<?php

namespace Database\Factories;

use App\Models\Character;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Character> */
class CharacterFactory extends Factory
{
    public function definition(): array
    {
        return [
            'slug' => fake()->unique()->slug(1),
            'name' => fake()->firstName(),
        ];
    }
}
