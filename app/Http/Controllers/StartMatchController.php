<?php

namespace App\Http\Controllers;

use App\Actions\Matches\StartMatch;
use App\Http\Requests\StoreMatchRequest;
use App\Http\Resources\PartyMatchResource;
use App\Models\Room;

class StartMatchController extends Controller
{
    public function __invoke(StoreMatchRequest $request, Room $room, StartMatch $startMatch): PartyMatchResource
    {
        return new PartyMatchResource($startMatch->handle($room));
    }
}
