<?php

namespace App\Http\Controllers;

use App\Support\LauncherBadges;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class FreePlayController extends Controller
{
    /** Badge key in the launcher for trying Free Play. */
    public const BADGE = 'free-play';

    /** Free Play happens in the browser, so the client tells us when a player starts it. Players without a launcher account are skipped. */
    public function __invoke(Request $request, LauncherBadges $badges): Response
    {
        if ($request->user()) {
            $badges->earn($request->user(), self::BADGE);
        }

        return response()->noContent();
    }
}
