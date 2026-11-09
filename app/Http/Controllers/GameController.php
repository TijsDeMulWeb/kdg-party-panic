<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;

class GameController extends Controller
{
    public function __invoke(): View
    {
        return view('game');
    }
}
