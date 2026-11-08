import * as THREE from 'three';
import { InputManager } from './InputManager';
import { SceneManager } from './SceneManager';

/** Longest simulated step; protects physics after tab switches or hitches. */
const MAX_FRAME_TIME = 1 / 20;

/**
 * Owns the renderer, main loop, input and scene manager. Knows nothing
 * about menus or minigames; GameManager decides what to show.
 */
export class Game {
    readonly renderer: THREE.WebGLRenderer;
    readonly input: InputManager;
    readonly scenes: SceneManager;
    readonly uiRoot: HTMLElement;

    private readonly timer = new THREE.Timer();

    constructor(container: HTMLElement, uiRoot: HTMLElement) {
        this.uiRoot = uiRoot;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        container.append(this.renderer.domElement);

        this.input = new InputManager(this.renderer.domElement, uiRoot);
        this.scenes = new SceneManager(this.renderer, uiRoot);

        window.addEventListener('resize', this.onResize);
        this.onResize();
    }

    start(): void {
        this.timer.connect(document);
        this.renderer.setAnimationLoop(this.tick);
    }

    private readonly tick = (timestamp: number): void => {
        this.timer.update(timestamp);
        const dt = Math.min(this.timer.getDelta(), MAX_FRAME_TIME);

        this.input.update();
        this.scenes.update(dt);
        this.scenes.render();
    };

    private readonly onResize = (): void => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height);
        this.scenes.resize(width, height);
    };
}
