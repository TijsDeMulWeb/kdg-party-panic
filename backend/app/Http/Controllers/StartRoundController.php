<?php

namespace App\Http\Controllers;

use App\Actions\Rooms\StartRound;
use App\Http\Requests\StartRoundRequest;
use App\Http\Resources\MatchRoundResource;
use App\Models\Room;

class StartRoundController extends Controller
{
    public function __invoke(StartRoundRequest $request, Room $room, StartRound $startRound): MatchRoundResource
    {
        return new MatchRoundResource($startRound->handle($room));
    }
}
