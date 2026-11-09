<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePlayerRequest;
use App\Http\Resources\PlayerResource;
use App\Models\Character;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class PlayersController extends Controller
{
    public function store(StorePlayerRequest $request): JsonResponse
    {
        $player = User::create([
            'name' => $request->validated('name'),
            'character_id' => Character::where('slug', $request->validated('character'))->value('id'),
        ]);

        Auth::login($player, remember: true);
        $request->session()->regenerate();

        return (new PlayerResource($player))->response()->setStatusCode(201);
    }
}
