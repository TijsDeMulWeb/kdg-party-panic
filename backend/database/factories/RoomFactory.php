<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Room> */
class RoomFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => Str::upper(Str::random(5)),
            'host_id' => User::factory(),
        ];
    }
}
