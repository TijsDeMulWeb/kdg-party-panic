<?php

namespace App\Console\Commands;

use App\Models\Room;
use Illuminate\Console\Command;

class PruneStaleRoomsCommand extends Command
{
    protected $signature = 'rooms:prune-stale {--hours=6 : Rooms untouched for this long are removed}';

    protected $description = 'Remove party rooms nobody has used for a while';

    public function handle(): void
    {
        $staleRooms = Room::where('updated_at', '<', now()->subHours((int) $this->option('hours')))
            ->whereDoesntHave('matches', fn ($query) => $query->where('updated_at', '>=', now()->subHours((int) $this->option('hours'))))
            ->get();

        $staleRooms->each(function (Room $room) {
            $this->info("Removing room `{$room->code}`...");
            $room->delete();
        });

        $this->comment("Removed {$staleRooms->count()} stale rooms.");
    }
}
