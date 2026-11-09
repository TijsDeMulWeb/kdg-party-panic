<?php

namespace App\Http\Controllers;

use App\Http\Resources\MatchHistoryResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MatchHistoryController extends Controller
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $entries = $request->user()->matchEntries()
            ->whereHas('partyMatch', fn ($query) => $query->whereNotNull('finished_at'))
            ->with('partyMatch.players.user', 'character')
            ->latest('id')
            ->limit(10)
            ->get();

        return MatchHistoryResource::collection($entries);
    }
}
