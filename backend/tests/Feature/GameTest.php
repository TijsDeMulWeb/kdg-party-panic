<?php

namespace Tests\Feature;

use Tests\TestCase;

class GameTest extends TestCase
{
    public function test_the_home_page_serves_the_built_game_or_explains_how_to_build_it(): void
    {
        $response = $this->get(route('home'));

        is_file(public_path('app/index.html'))
            ? $response->assertOk()->assertSee('<div id="app">', false)
            : $response->assertStatus(503)->assertSee('npm run build');
    }
}
