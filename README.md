<img src="assets/icon.svg" width="64" height="64" alt="">

# Party Panic

Browser-based multiplayer arcade party game. 1 to 4 players, fourteen short minigames, five per match, cartoon 3D style with seasonal themes.

## Layout

```
client/    Game client (TypeScript, Three.js, Vite)
backend/   Laravel API + Pusher broadcasting (phase 3)
docs/      Architecture notes
```

## Running locally

Solo play only needs the client. Private parties also need the Laravel backend (Herd) and a realtime server (Reverb locally, Pusher in production).

```bash
# Backend: served by Herd at http://party-panic.test
cd backend
composer install
cp .env.example .env && php artisan key:generate   # set DB_* for MySQL
php artisan migrate --seed
php artisan reverb:start                           # realtime server on :8080

# Client
cd client
npm install
cp .env.example .env.local                         # VITE_PUSHER_KEY = REVERB_APP_KEY
npm run dev                                        # http://localhost:5173
```

The Vite dev server proxies `/api` and `/broadcasting` to the backend, so the game and the API share one origin (session cookie, CSRF).

To use Pusher instead of Reverb: set `BROADCAST_CONNECTION=pusher` and the `PUSHER_*` keys in `backend/.env`, and `VITE_PUSHER_KEY` and `VITE_PUSHER_CLUSTER` (empty host and port) in the client.

Backend tests: `cd backend && php artisan test`.

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
