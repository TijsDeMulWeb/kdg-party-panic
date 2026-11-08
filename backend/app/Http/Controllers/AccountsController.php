<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAccountRequest;
use App\Http\Resources\PlayerResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AccountsController extends Controller
{
    /** Registers an account. A logged-in guest keeps their history: the same row is upgraded. */
    public function store(StoreAccountRequest $request): JsonResponse
    {
        $user = $request->user() ?? new User;

        if (! $user->isGuest()) {
            throw ValidationException::withMessages(['email' => 'You are already logged in to an account.']);
        }

        $user->fill($request->validated())->save();

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return (new PlayerResource($user->fresh()))->response()->setStatusCode(201);
    }
}
