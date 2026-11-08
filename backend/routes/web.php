<?php

use App\Http\Controllers\ClockController;
use App\Http\Controllers\CurrentPlayerController;
use App\Http\Controllers\PlayersController;
use App\Http\Controllers\RoomMembershipsController;
use App\Http\Controllers\RoomsController;
use App\Http\Controllers\StartRoundController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
})->name('home');

Route::prefix('api')->group(function () {
    Route::get('clock', ClockController::class)->name('clock.show');

    Route::post('players', [PlayersController::class, 'store'])->name('players.store');
    Route::get('me', [CurrentPlayerController::class, 'show'])->name('currentPlayer.show');

    Route::middleware('auth')->group(function () {
        Route::patch('me', [CurrentPlayerController::class, 'update'])->name('currentPlayer.update');

        Route::post('rooms', [RoomsController::class, 'store'])->name('rooms.store');
        Route::get('rooms/{room}', [RoomsController::class, 'show'])->name('rooms.show')->can('view', 'room');

        Route::post('rooms/{room}/memberships', [RoomMembershipsController::class, 'store'])->name('roomMemberships.store');
        Route::patch('rooms/{room}/memberships', [RoomMembershipsController::class, 'update'])->name('roomMemberships.update');
        Route::delete('rooms/{room}/memberships', [RoomMembershipsController::class, 'destroy'])->name('roomMemberships.destroy')->can('leave', 'room');

        Route::post('rooms/{room}/rounds', StartRoundController::class)->name('rounds.store');
    });
});
