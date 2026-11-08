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
scenes/            MainMenuScene, PlaygroundScene. Minigames will live in minigames/.
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
