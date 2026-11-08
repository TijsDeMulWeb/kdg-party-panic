<img src="assets/icon.svg" width="64" height="64" alt="">

# Party Panic

Browser-based multiplayer arcade party game. 1 to 4 players, five short minigames per match, cartoon 3D style.

## Layout

```
client/    Game client (TypeScript, Three.js, Vite)
server/    Colyseus realtime server (phase 3)
backend/   Laravel API (phase 6)
docs/      Architecture notes
```

## Running the client

```bash
cd client
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

Dev shortcut: `http://localhost:5173/?scene=freeplay` skips the title screen.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | Left stick | Left joystick |
| Jump | Space | A | Jump button |
| Action (dash) | Shift / E / J | X or B | Dash button |
| Camera | Drag with mouse | Right stick | Drag on screen |
| Back to menu | Esc | | Menu button |

See [docs/architecture.md](docs/architecture.md) for design decisions.
