# Architecture

## Client layers

```
main.ts            Entry point. Creates Game and GameManager, nothing else.
core/              Engine level, no game rules.
  Game             Renderer, main loop, owns InputManager and SceneManager.
  GameManager      App flow: which scene is shown, local player choices.
  SceneManager     Active scene lifecycle (enter/exit/dispose) and fade transitions.
  GameScene        Interface every screen with a 3D scene implements.
  InputManager     Keyboard, gamepad and touch merged into one InputSnapshot per frame.
  CameraRig        Third-person follow camera with drag rotation and shake.
design/            Visual design system: palette, toon materials, ink outlines, sky, lighting, clouds.
characters/        Roster, procedural CharacterModel, pure movement simulation, CharacterController.
world/             StaticWorld collision and reusable props (islands, blocks, trees, balloons).
effects/           Pooled instanced particles and named presets (landing, dash, confetti).
scenes/            MainMenuScene, PlaygroundScene, MinigameScene (runner for any minigame).
minigames/         One folder per minigame plus types.ts and registry.ts.
scoring/           Personal bests (local until the backend exists).
multiplayer/       Laravel API client, server clock, Pusher connection, PartySession, remote players.
ui/                DOM overlays (menu, HUD, touch controls, fades). Styles in ui/styles.css.
utils/             Math and storage helpers.
```

## Decisions

**Scenes never create scenes.** They receive callbacks (`onExit`, `onFreePlay`) and GameManager decides what comes next. This keeps minigames independent: a minigame only needs to report a result.

**Input is intent, not devices.** Scenes read `InputSnapshot` (move vector, jump, action, look delta). Adding a device or rebinding keys never touches gameplay code. Key bindings use `event.code`, so AZERTY and QWERTY both work on the same physical keys.

**Movement is pure.** `characters/movement.ts` has no Three.js or DOM imports. It takes state, input, config and a `MovementWorld` and returns events. Each client simulates its own character and shares its position over Pusher client events; the same code drives local play and can later be used to replay inputs for score validation.

**Model and simulation are separate.** `CharacterModel` only animates from motion values (speed, grounded, vertical velocity). The same model works for the local player, remote players driven by server snapshots and menu idles.

**Kinematic collisions for now, Rapier later.** `StaticWorld` (boxes and vertical cylinders) is enough for arenas and platforms and is deterministic and cheap. Rapier is added when a minigame needs rigid bodies (Big Ball, Vacuum Chaos), not before.

**One visual system.** Colours live in `design/palette.ts` and are mirrored as CSS custom properties. All 3D objects use cached `MeshToonMaterial`s with a shared three-step gradient and inverted-hull ink outlines. Shared materials are flagged `userData.shared` so scene disposal does not free them.

**Fixed-step safety.** Frame time is clamped to 50 ms so a background tab or a hitch never tunnels a character through the floor.

## Minigames

A minigame is a folder in `minigames/` that exports a `MinigameDefinition` (name, duration, instructions, `create()`), registered in `minigames/registry.ts`. Registering it is enough for it to show up in Solo Arcade.

`MinigameScene` runs every minigame through the same flow: intro card, 3-2-1 countdown, timed play, results. It owns the timer, input enabling and the shared `GameHud` (score, timer, callouts). The minigame only owns its world and rules and reports `isOver()` and `getResult()`. In multiplayer the same runner will take its timing from Laravel instead of the local clock.

**Rules are separated from rendering.** Each minigame keeps its rules in a pure module (`color-crash/rounds.ts`): schedule, layouts and scoring, driven by a seed via `utils/random.ts`. Same seed gives the same game, which is what multiplayer rooms and daily challenges need, and lets the backend compute the maximum possible score for a seed to reject impossible submissions.

**Accessibility.** Color Crash pairs every colour with a symbol, so it is playable without telling colours apart.

## Multiplayer (Laravel + Pusher protocol)

Laravel is the authority for everything that is not movement: guest players, rooms, seats, characters, ready states, which minigame is played, its seed and its exact start time. Realtime traffic goes over a Pusher-protocol presence channel per room (`presence-room.{code}`): Pusher Channels in production, Laravel Reverb locally. The client uses `pusher-js` directly, no Echo.

- **Guests are users.** A guest is a `users` row without email or password, logged in with the normal session guard. Phase 6 can upgrade the same row to a full account.
- **Server events**: `room.updated` (full roster after any change) and `round.starting` (minigame, seed, `starts_at` in server ms). Both are `ShouldBroadcastNow`, so no queue worker is needed.
- **Client events**: each client sends its own movement as `client-snapshot` about 9 times per second (Pusher's limit is 10 per second per client). Others render it 150 ms in the past and interpolate between snapshots.
- **One clock.** Clients estimate their offset to server time via `GET /api/clock` (lowest round trip of 5 samples). Countdown, play time and tile drops all follow the server clock, so every client drops the same tiles at the same moment.
- **Same seed, same game.** The round's seed drives the minigame's pure rules module, so all clients build identical layouts without sending them.
- **Bumping without authority.** Each client pushes only its own character out of the others (`WorldWithMovingObstacles`). Symmetric, and nobody moves someone else.
- **Disconnects.** Presence shows a player as offline immediately. Laravel removes members who are no longer subscribed when someone joins a full room or the host starts (it asks the Pusher/Reverb HTTP API who is in the channel), with a 15 second grace period for players who are still connecting. Reloading the page returns to the lobby via the remembered room code and the session cookie.

**Trade-off.** Clients are authoritative over their own movement and survival. Fine for private parties among friends; scores that go on global leaderboards need extra validation (phase 6).
