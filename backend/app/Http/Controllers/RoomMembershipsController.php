<?php

namespace App\Http\Controllers;

use App\Actions\Rooms\JoinRoom;
use App\Actions\Rooms\LeaveRoom;
use App\Events\RoomUpdated;
use App\Http\Requests\StoreRoomMembershipRequest;
use App\Http\Requests\UpdateRoomMembershipRequest;
use App\Http\Resources\RoomResource;
use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class RoomMembershipsController extends Controller
{
    public function store(StoreRoomMembershipRequest $request, Room $room, JoinRoom $joinRoom): RoomResource
    {
        $joinRoom->handle($room, $request->user());

        return new RoomResource($room->load('players'));
    }

    public function update(UpdateRoomMembershipRequest $request, Room $room): RoomResource
    {
        $changes = [];

        if ($request->has('is_ready')) {
            $changes['is_ready'] = $request->boolean('is_ready');
        }

        if ($request->filled('character')) {
            $changes['character_id'] = $request->characterId();
        }

        $room->players()->updateExistingPivot($request->user()->id, $changes);

        broadcast(new RoomUpdated($room))->toOthers();

        return new RoomResource($room->load('players'));
    }

    public function destroy(Request $request, Room $room, LeaveRoom $leaveRoom): Response
    {
        $leaveRoom->handle($room, $request->user());

        return response()->noContent();
    }
}
