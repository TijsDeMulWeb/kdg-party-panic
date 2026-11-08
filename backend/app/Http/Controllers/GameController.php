<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

/**
 * Serves the built game (client/ → public/app) from the same domain as
 * the API, so the session cookie and CSRF protection work without CORS.
 */
class GameController extends Controller
{
    public function __invoke(): Response
    {
        $index = public_path('app/index.html');

        if (! is_file($index)) {
            return response('The game has not been built yet. Run `npm run build` in client/.', 503);
        }

        return response(file_get_contents($index))
            ->header('Content-Type', 'text/html; charset=UTF-8')
            ->header('Cache-Control', 'no-cache');
    }
}
