<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Laravel\Socialite\Facades\Socialite;

class RedirectToLauncherController extends Controller
{
    public function __invoke(): RedirectResponse
    {
        return Socialite::driver('launcher')->redirect();
    }
}
