import type * as THREE from 'three';
import type { CharacterDefinition } from '../characters/roster';
import type { InputSnapshot } from '../core/InputManager';
import type { GameHud } from '../ui/minigame/GameHud';

export interface MinigameContext {
    character: CharacterDefinition;
    /** Seeds every gameplay-relevant random choice. Same seed, same game. */
    seed: number;
    /** Shared HUD (score, timer, popups) owned by the runner. */
    hud: GameHud;
    /** Container for minigame-specific overlays. Cleared by the runner. */
    overlay: HTMLElement;
}

export interface MinigameStat {
    label: string;
    value: string;
}

export interface MinigameResult {
    score: number;
    /** Headline shown on the results card, e.g. "Time's up!" or "Splash!". */
    title: string;
    stats: MinigameStat[];
}

/**
 * One running minigame. The runner (scenes/MinigameScene) owns timing,
 * intro, countdown and results; the minigame only owns its world and rules.
 */
export interface Minigame {
    readonly scene: THREE.Scene;
    readonly camera: THREE.Camera;

    /** Countdown finished: gameplay starts now. */
    start(): void;
    /** Called every frame. `playing` is false during intro, countdown and after the end. */
    update(dt: number, input: InputSnapshot, playing: boolean): void;
    /** True once the player can no longer change their score (eliminated, all rounds done). */
    isOver(): boolean;
    getResult(): MinigameResult;
    resize(width: number, height: number): void;
    dispose(): void;
}

export interface MinigameDefinition {
    id: string;
    name: string;
    tagline: string;
    /** CSS colour used for cards and intro screens. */
    accent: string;
    durationSeconds: number;
    instructions: string[];
    /** Name of the action button in this minigame, shown on touch controls. */
    actionLabel: string;
    create(context: MinigameContext): Minigame;
}
