<?php

use App\Http\Controllers\AccountsController;
use App\Http\Controllers\ClockController;
use App\Http\Controllers\CurrentPlayerController;
use App\Http\Controllers\DailyChallengeLeaderboardController;
use App\Http\Controllers\DailyChallengeRunsController;
use App\Http\Controllers\DailyChallengesController;
use App\Http\Controllers\FinalizeRoundController;
use App\Http\Controllers\LeaderboardsController;
use App\Http\Controllers\MatchHistoryController;
use App\Http\Controllers\PlayersController;
use App\Http\Controllers\RoomMembershipsController;
use App\Http\Controllers\RoomsController;
use App\Http\Controllers\RoundResultsController;
use App\Http\Controllers\RunsController;
use App\Http\Controllers\SessionsController;
use App\Http\Controllers\StartMatchController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
})->name('home');

Route::prefix('api')->group(function () {
    Route::get('clock', ClockController::class)->name('clock.show');

    Route::post('players', [PlayersController::class, 'store'])->name('players.store');
    Route::get('me', [CurrentPlayerController::class, 'show'])->name('currentPlayer.show');

    Route::post('accounts', [AccountsController::class, 'store'])->name('accounts.store');
    Route::post('session', [SessionsController::class, 'store'])->name('session.store')->middleware('throttle:10,1');

    Route::get('minigames/{minigame}/leaderboard', [LeaderboardsController::class, 'show'])->name('leaderboards.show');
    Route::get('daily-challenge', [DailyChallengesController::class, 'show'])->name('dailyChallenge.show');
    Route::get('daily-challenge/leaderboard', DailyChallengeLeaderboardController::class)->name('dailyChallengeLeaderboard.show');

    Route::middleware('auth')->group(function () {
        Route::patch('me', [CurrentPlayerController::class, 'update'])->name('currentPlayer.update');
        Route::get('me/matches', MatchHistoryController::class)->name('matchHistory.index');
        Route::delete('session', [SessionsController::class, 'destroy'])->name('session.destroy');

        Route::post('rooms', [RoomsController::class, 'store'])->name('rooms.store');
        Route::get('rooms/{room}', [RoomsController::class, 'show'])->name('rooms.show')->can('view', 'room');

        Route::post('rooms/{room}/memberships', [RoomMembershipsController::class, 'store'])->name('roomMemberships.store');
        Route::patch('rooms/{room}/memberships', [RoomMembershipsController::class, 'update'])->name('roomMemberships.update');
        Route::delete('rooms/{room}/memberships', [RoomMembershipsController::class, 'destroy'])->name('roomMemberships.destroy')->can('leave', 'room');

        Route::post('rooms/{room}/matches', StartMatchController::class)->name('matches.store');

        Route::get('rounds/{round}/results', [RoundResultsController::class, 'index'])->name('roundResults.index')->can('view', 'round');
        Route::post('rounds/{round}/results', [RoundResultsController::class, 'store'])->name('roundResults.store');
        Route::post('rounds/{round}/finalization', FinalizeRoundController::class)->name('roundFinalization.store')->can('view', 'round');

        Route::post('minigames/{minigame}/runs', [RunsController::class, 'store'])->name('runs.store')->middleware('throttle:30,1');
        Route::patch('runs/{run}', [RunsController::class, 'update'])->name('runs.update');
        Route::post('daily-challenge/runs', [DailyChallengeRunsController::class, 'store'])->name('dailyChallengeRuns.store')->middleware('throttle:30,1');
    });
});
