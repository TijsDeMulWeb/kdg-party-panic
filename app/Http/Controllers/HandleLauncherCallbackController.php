<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class HandleLauncherCallbackController extends Controller
{
    /** Logs the player in with their launcher account. A logged-in guest keeps their history: the same row is linked. */
    public function __invoke(Request $request): RedirectResponse
    {
        if ($request->query('error')) {
            return redirect()->route('home');
        }

        $launcherUser = Socialite::driver('launcher')->user();

        $user = User::firstWhere('launcher_id', $launcherUser->getId()) ?? $this->guestOrNewUser($request);

        if ($user->launcher_id === null) {
            $user->name = Str::limit($launcherUser->first_name, 16, '');
        }

        $user->launcher_id = $launcherUser->getId();
        $user->launcher_token = $launcherUser->token;
        $user->save();

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return redirect()->route('home');
    }

    private function guestOrNewUser(Request $request): User
    {
        $currentUser = $request->user();

        return $currentUser?->isGuest() ? $currentUser : new User;
    }
}
