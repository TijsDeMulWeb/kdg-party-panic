<?php

namespace Database\Seeders;

use App\Models\Hat;
use Illuminate\Database\Seeder;

class HatSeeder extends Seeder
{
    public function run(): void
    {
        collect([
            'party-hat' => 'Party hat',
            'crown' => 'Crown',
            'cap' => 'Cap',
            'bow' => 'Bow',
            'flower' => 'Flower',
            'santa-hat' => 'Santa hat',
            'witch-hat' => 'Witch hat',
            'bunny-ears' => 'Bunny ears',
        ])->each(fn (string $name, string $slug) => Hat::updateOrCreate(['slug' => $slug], ['name' => $name]));
    }
}
