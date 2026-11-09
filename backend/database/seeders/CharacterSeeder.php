<?php

namespace Database\Seeders;

use App\Models\Character;
use Illuminate\Database\Seeder;

class CharacterSeeder extends Seeder
{
    public function run(): void
    {
        collect([
            'pip' => 'Pip',
            'blu' => 'Blu',
            'zing' => 'Zing',
            'moss' => 'Moss',
        ])->each(fn (string $name, string $slug) => Character::updateOrCreate(['slug' => $slug], ['name' => $name]));
    }
}
