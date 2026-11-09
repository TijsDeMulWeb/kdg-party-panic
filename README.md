<img src="assets/icon.svg" width="64" height="64" alt="">

# Party Panic

Browser-based multiplayer arcade party game. 1 to 4 players, fourteen short minigames, five per match, cartoon 3D style with seasonal themes.

## Layout

One Laravel app: the API, Pusher broadcasting and the game itself.

```
app/, routes/, database/   Laravel API (rooms, matches, runs, leaderboards)
resources/js/              Game (TypeScript, Three.js), entry resources/js/app.ts
resources/views/game.blade.php   The page that loads the game
docs/                      Architecture and deploy notes
```

## Running locally

Served by Herd at http://party-panic.test.

```bash
composer install
npm install
cp .env.example .env && php artisan key:generate   # DB_* for MySQL, PUSHER_* keys
php artisan migrate --seed
npm run dev                                        # hot reload on http://party-panic.test
```

`npm run build` writes the production game to `public/build`. Private parties need `BROADCAST_CONNECTION=pusher` and the `PUSHER_*` keys in `.env`; the game reads them through the `VITE_PUSHER_*` lines.

Tests: `php artisan test` (PHP) and `npm run typecheck` (game).

Scheduled tasks: `php artisan schedule:work` locally (or `schedule:run` from cron) runs `rooms:prune-stale` hourly.

Dev shortcuts (only in `npm run dev`):

- `?scene=freeplay` opens the practice island.
- `?scene=<minigame>` opens a minigame directly (`color-crash`, `package-panic`, `big-ball`, `vacuum-chaos`, `paint-party`, `meteor-mayhem`, `sky-tower`, `fruit-frenzy`, `bumper-sumo`, `snowball-splat`, `quick-draw`, `ice-slide`, `kart-race`, `hot-potato`). Add `&seed=42` for a fixed layout.
- `?season=christmas` (or `halloween`, `easter`, `default`) previews a seasonal theme.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | Left stick | Left joystick |
| Jump | Space | A | Jump button |
| Action (dash, shove, vacuum) | Shift / E / J | X or B | Action button |
| Camera | Drag with mouse | Right stick | Drag on screen |
| Back to menu | Esc | | Menu button |

See [docs/architecture.md](docs/architecture.md) for design decisions.
