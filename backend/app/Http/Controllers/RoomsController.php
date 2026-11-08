<?php

namespace App\Http\Controllers;

use App\Actions\Rooms\CreateRoom;
use App\Http\Requests\StoreRoomRequest;
use App\Http\Resources\RoomResource;
use App\Models\Room;
use Illuminate\Http\JsonResponse;

class RoomsController extends Controller
{
    public function store(StoreRoomRequest $request, CreateRoom $createRoom): JsonResponse
    {
        $room = $createRoom->handle($request->user());

        return (new RoomResource($room->load('players')))->response()->setStatusCode(201);
    }

    public function show(Room $room): RoomResource
    {
        return new RoomResource($room->load('players'));
    }
}
