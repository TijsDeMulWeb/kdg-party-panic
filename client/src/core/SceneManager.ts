import type * as THREE from 'three';
import type { GameScene } from './GameScene';
import { ScreenFade } from '../ui/ScreenFade';
import { disposeObject } from './dispose';

/** Owns the active scene and handles transitions between scenes. */
export class SceneManager {
    private current: GameScene | null = null;
    private switching = false;
    private size = { width: 1, height: 1 };
    private readonly fade: ScreenFade;

    constructor(private readonly renderer: THREE.WebGLRenderer, uiRoot: HTMLElement) {
        this.fade = new ScreenFade(uiRoot);
    }

    get active(): GameScene | null {
        return this.current;
    }

    async switchTo(next: GameScene): Promise<void> {
        if (this.switching) {
            return;
        }

        this.switching = true;

        if (this.current) {
            await this.fade.cover();
            this.current.exit();
            disposeObject(this.current.scene);
        }

        this.current = next;
        next.resize(this.size.width, this.size.height);
        next.enter();
        // Compile shaders up front so the first visible frame does not hitch.
        this.renderer.compile(next.scene, next.camera);
        next.update(0);

        await this.fade.reveal();
        this.switching = false;
    }

    resize(width: number, height: number): void {
        this.size = { width, height };
        this.current?.resize(width, height);
    }

    update(dt: number): void {
        this.current?.update(dt);
    }

    render(): void {
        if (this.current) {
            this.renderer.render(this.current.scene, this.current.camera);
        }
    }
}
