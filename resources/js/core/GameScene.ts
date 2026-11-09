import type * as THREE from 'three';

/**
 * Contract for every screen that owns a 3D scene: menus, the playground
 * and (later) each minigame. The SceneManager drives the lifecycle.
 */
export interface GameScene {
    readonly scene: THREE.Scene;
    readonly camera: THREE.Camera;

    /** Build DOM UI and start listening. Called after the scene becomes active. */
    enter(): void;
    /** Remove DOM UI and release GPU resources. */
    exit(): void;
    update(dt: number): void;
    resize(width: number, height: number): void;
}
