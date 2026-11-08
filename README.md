<img src="assets/icon.svg" width="64" height="64" alt="">

# Party Panic

Browser-based multiplayer arcade party game. 1 to 4 players, five short minigames per match, cartoon 3D style.

## Layout

```
client/    Game client (TypeScript, Three.js, Vite)
backend/   Laravel API + Pusher broadcasting (phase 3)
docs/      Architecture notes
```

## Running the client

```bash
cd client
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

Dev shortcuts (only in `npm run dev`):

- `?scene=freeplay` opens the practice island.
- `?scene=color-crash` opens a minigame directly. Add `&seed=42` for a fixed layout.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | Left stick | Left joystick |
| Jump | Space | A | Jump button |
| Action (dash) | Shift / E / J | X or B | Dash button |
| Camera | Drag with mouse | Right stick | Drag on screen |
| Back to menu | Esc | | Menu button |

See [docs/architecture.md](docs/architecture.md) for design decisions.
