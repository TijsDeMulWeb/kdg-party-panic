<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateCurrentPlayerRequest;
use App\Http\Resources\PlayerResource;
use App\Models\Character;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CurrentPlayerController extends Controller
{
    /** Returns `data: null` instead of a 401 so the client can check for a session quietly. */
    public function show(Request $request): PlayerResource|JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['data' => null]);
        }

        return new PlayerResource($request->user());
    }

    public function update(UpdateCurrentPlayerRequest $request): PlayerResource
    {
        $player = $request->user();

        if ($request->has('name')) {
            $player->name = $request->validated('name');
        }

        if ($request->has('character')) {
            $player->character_id = Character::where('slug', $request->validated('character'))->value('id');
        }

        $player->save();

        return new PlayerResource($player);
    }
}
