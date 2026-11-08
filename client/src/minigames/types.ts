import type * as THREE from 'three';
import type { CharacterDefinition } from '../characters/roster';
import type { InputSnapshot } from '../core/InputManager';
import type { GameHud } from '../ui/minigame/GameHud';
import type { PlayerSnapshot } from '../multiplayer/types';

export interface NetworkPlayer {
    id: number;
    name: string;
    seat: number;
    character: CharacterDefinition;
    hat: string | null;
}

/**
 * Everything a minigame needs to play with others. Absent in solo play.
 * Minigames never talk to Pusher or Laravel directly.
 */
export interface MinigameNetwork {
    localSeat: number;
    remotePlayers: readonly NetworkPlayer[];
    /** Server-synchronised time in milliseconds. */
    serverNow(): number;
    send(snapshot: Omit<PlayerSnapshot, 'p'>): void;
    onSnapshot(listener: (playerId: number, snapshot: PlayerSnapshot) => void): () => void;
    onPresence(listener: (online: ReadonlySet<number>) => void): () => void;
    isOnline(playerId: number): boolean;
}

export interface MinigameContext {
    character: CharacterDefinition;
    hat: string | null;
    /** Seeds every gameplay-relevant random choice. Same seed, same game. */
    seed: number;
    /** Shared HUD (score, timer, popups) owned by the runner. */
    hud: GameHud;
    /** Container for minigame-specific overlays. Cleared by the runner. */
    overlay: HTMLElement;
    network?: MinigameNetwork;
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
    /** Current score, shown live to other players in a party. */
    getScore(): number;
    /**
     * Called every frame. `elapsed` is the official play time in seconds
     * (server-synchronised in multiplayer), or null outside of play.
     */
    update(dt: number, input: InputSnapshot, elapsed: number | null): void;
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
    /** Loads the minigame's code on demand, so the first page load stays small. */
    load(): Promise<MinigameFactory>;
}

export type MinigameFactory = (context: MinigameContext) => Minigame;
