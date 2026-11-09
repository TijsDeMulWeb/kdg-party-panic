<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

/** Lets clients estimate their offset to server time, so rounds start in sync. */
class ClockController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['now' => now()->getTimestampMs()]);
    }
}
