# Architecture

## Game layers (resources/js)

```
app.ts             Entry point. Creates Game and GameManager, nothing else.
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
online/            Local profile plus solo runs, daily challenge, leaderboards and accounts.
audio/             Synthesised sound effects and music (Web Audio, no files).
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

Laravel is the authority for everything that is not movement: guest players, rooms, seats, characters, ready states, which minigame is played, its seed and its exact start time. Realtime traffic goes over a Pusher-protocol presence channel per room (`presence-room.{code}`): Pusher Channels. The game uses `pusher-js` directly, no Echo.

- **Guests are users.** A guest is a `users` row without email or password, logged in with the normal session guard. Phase 6 can upgrade the same row to a full account.
- **Server events**: `room.updated` (full roster after any change) and `round.starting` (minigame, seed, `starts_at` in server ms). Both are `ShouldBroadcastNow`, so no queue worker is needed.
- **Client events**: each client sends its own movement as `client-snapshot` about 9 times per second (Pusher's limit is 10 per second per client). Others render it 150 ms in the past and interpolate between snapshots.
- **One clock.** Clients estimate their offset to server time via `GET /api/clock` (lowest round trip of 5 samples). Countdown, play time and tile drops all follow the server clock, so every client drops the same tiles at the same moment.
- **Same seed, same game.** The round's seed drives the minigame's pure rules module, so all clients build identical layouts without sending them.
- **Bumping without authority.** Each client pushes only its own character out of the others (`WorldWithMovingObstacles`). Symmetric, and nobody moves someone else.
- **Disconnects.** Presence shows a player as offline immediately. Laravel removes members who are no longer subscribed when someone joins a full room or the host starts (it asks the Pusher HTTP API who is in the channel), with a 15 second grace period for players who are still connecting. Reloading the page returns to the lobby via the remembered room code and the session cookie.

**Trade-off.** Clients are authoritative over their own movement and survival. Fine for private parties among friends; scores that go on global leaderboards need extra validation (phase 6).

## Tournament (phase 4)

A match is five rounds. Laravel picks the minigames (every minigame once, then random extras, never twice in a row) and a seed per round, and schedules one round at a time.

1. Round N starts at a server time. Every client plays it (see Multiplayer).
2. At the final whistle each client reports its score (`POST rounds/{id}/results`). Scores above the minigame's `max_score` are rejected.
3. When everyone still in the room has reported, Laravel finalizes the round. If someone never reports, any client asks for finalization (`POST rounds/{id}/finalization`) once the 4 second submission window has passed. Finalizing is idempotent: the first call claims the round with a conditional update.
4. Placements use competition ranking (equal scores share a place): 10, 7, 5, 3 points. Players who never reported get no placement and 0 points.
5. Laravel broadcasts `round.finished` (results + standings) and schedules the next round 18 seconds later (results, standings and the next intro) (`round.starting`). After round 5 the match is finished and final ranks are stored for the match history.

Standings: total points, then total score as tie-breaker.

## Leaderboards and daily challenge (phase 6)

Solo scores only count when they belong to a **run** the server handed out: `POST minigames/{slug}/runs` returns a server-chosen seed. The score is accepted once, within the minigame's duration plus 5 minutes, and only up to the minigame's `max_score`. Without a server the game still plays with a local seed; the score just isn't ranked.

The **daily challenge** is created lazily from the date: minigame and seed are derived from `crc32(date)`, so everyone gets the same layout. Rule: your first finished attempt of the day is your official score; later attempts are practice and don't change the daily leaderboard.

Guests are `users` without email. Creating an account upgrades the same row, so runs and match history are kept.

**Limits of the validation.** The server cannot replay a run (the rules live in TypeScript), so it checks ownership, timing, single submission and the per-minigame maximum. A determined cheater can still submit a high but possible score. Replaying recorded inputs on the server would close that gap.

## Minigames (phase 5)

| Minigame | Rules module | Multiplayer data in snapshots |
| --- | --- | --- |
| Color Crash | `color-crash/rounds.ts` | position, live score |
| Package Panic | `package-panic/rules.ts` | position, live score (each player has their own belt) |
| Big Ball | `big-ball/rules.ts`, `big-ball/ball.ts` | position, score, ball position (`e = [x, z]`) |
| Vacuum Chaos | `vacuum-chaos/rules.ts` | position, score, recent toy claims (`e = [toyId, time, ...]`) |
| Paint Party | `paint-party/rules.ts` | position, score, recent paints (`e = [tile, time, ...]`, latest paint wins) |
| Meteor Mayhem | `meteor-mayhem/rules.ts` | position, score, star claims |
| Sky Tower | `sky-tower/rules.ts` | position, score, star claims |
| Fruit Frenzy | `fruit-frenzy/rules.ts` | position, score, fruit claims |
| Bumper Sumo | `bumper-sumo/rules.ts` | position, score, dash hits (`e = [target, dx, dz, time, ...]`) |
| Snowball Splat | `snowball-splat/rules.ts` | position, score, packed sections: throws, hits taken, snowman claims |
| Quick Draw | `quick-draw/rules.ts` | score, reaction for the current duel (`e = [duel, ms]`) |
| Ice Slide | `ice-slide/rules.ts` | position, score |
| Mini Kart Race | `kart-race/track.ts`, `kart-race/kart.ts` | kart position and heading, score |
| Hot Potato | `hot-potato/rules.ts` | position, out flag, numbered bomb passes (`e = [round, seq, to, ...]`) |

Games that send several kinds of data pack them with `multiplayer/extraSections.ts`.

**Snowball Splat** uses the same idea as Bumper Sumo: every client simulates all snowballs, but only the player who gets hit decides that they were hit, and reports it so the thrower gets the points.

**Hot Potato** has one piece of shared state: who holds the bomb. Only the holder can pass it, so the holder's client decides and sends a numbered pass event; others apply the highest number they have seen. In solo play three simple computer players join (they chase when holding the bomb, flee otherwise).

**Mini Kart Race** doesn't use the character controller: `kart.ts` is a small arcade driving model, `track.ts` a closed spline with progress tracking and checkpoints so laps can't be cut short.

Arena minigames build on `minigames/shared/MinigameStage.ts` (sky, light, local and remote players, snapshots, follow camera). Anything players can grab first goes through `multiplayer/ClaimBook.ts`.

**Bumper Sumo and authority.** Nobody moves someone else's character. A dash into another player sends a hit in the snapshot; the victim's own client applies the knockback. That adds roughly 100 to 200 ms of delay to a shove, the price of not running a game server.

Big Ball uses a small custom ball simulation (`ball.ts`) instead of Rapier: one rolling sphere against boxes, bumpers and other balls doesn't need a 1 MB physics engine. Each client simulates its own ball; other balls are solid obstacles.

In Vacuum Chaos two players can grab the same toy. Claims travel in the snapshots for 2.5 seconds; every client applies the same rule (earliest server time wins, ties to the lowest player id), so they all agree and the loser's points are taken back.

## Audio and customisation (phase 7)

All sound is synthesised at runtime (`audio/sounds.ts`, `audio/music.ts`), so there are no audio files to load. The mute toggle is remembered.

Hats are cosmetic and stored per player (`hats` lookup table, `users.hat_id`). They are chosen in the wardrobe (hanger button, top right) or in the lobby and sent to everyone in the room.

## Seasons

`design/season.ts` picks a theme from the date: Christmas (1 December to 6 January), Halloween (15 October to 2 November) and Easter (two weeks before to one week after Easter Sunday, computed per year). `?season=christmas|halloween|easter|default` previews one.

A theme recolours the shared palette before anything is built (sky, fog, grass: snow at Christmas, dusk at Halloween, pastel at Easter), adds props to every party stage (`world/seasonalDecor.ts`: trees and presents, jack-o'-lanterns and bats, eggs and bunnies), drifts particles through every scene (`effects/SeasonalAmbience.ts`), changes logo colours, confetti, the tagline and the menu music, and unlocks one seasonal hat (Santa hat, witch hat, bunny ears) for the duration. Hats picked during a season keep rendering afterwards.
