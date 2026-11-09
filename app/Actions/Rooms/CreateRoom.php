<?php

namespace App\Actions\Rooms;

use App\Models\Room;
use App\Models\User;

class CreateRoom
{
    /** No 0/O or 1/I, so codes are easy to read out loud. */
    protected string $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(
        protected JoinRoom $joinRoom,
    ) {}

    public function handle(User $host): Room
    {
        $room = Room::create([
            'code' => $this->uniqueCode(),
            'host_id' => $host->id,
        ]);

        return $this->joinRoom->handle($room, $host);
    }

    protected function uniqueCode(): string
    {
        do {
            $code = collect(range(1, 5))
                ->map(fn () => $this->alphabet[random_int(0, strlen($this->alphabet) - 1)])
                ->implode('');
        } while (Room::where('code', $code)->exists());

        return $code;
    }
}
