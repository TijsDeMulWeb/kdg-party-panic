<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PruneStaleRoomsCommandTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_it_removes_rooms_that_have_not_been_used_for_hours(): void
    {
        $stale = Room::factory()->create(['updated_at' => now()->subHours(7)]);
        $active = Room::factory()->create();

        $this->artisan('rooms:prune-stale')->expectsOutputToContain('Removed 1 stale rooms.')->assertSuccessful();

        $this->assertModelMissing($stale);
        $this->assertModelExists($active);
    }
}
