import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { GameScene } from '../core/GameScene';
import { CameraRig } from '../core/CameraRig';
import { CharacterController } from '../characters/CharacterController';
import { CharacterModel } from '../characters/CharacterModel';
import { ROSTER, type CharacterDefinition } from '../characters/roster';
import { createCloudLayer, createLighting, createSky, type CloudLayer, type Lighting } from '../design/environment';
import { palette } from '../design/palette';
import { Effects } from '../effects/Effects';
import { PlaygroundHud } from '../ui/PlaygroundHud';
import { StaticWorld } from '../world/StaticWorld';
import { createBlock, createFlower, createIsland, createTree } from '../world/props';
import { angleDelta, damp, randomRange } from '../utils/math';

export interface PlaygroundOptions {
    character: CharacterDefinition;
    hat: string | null;
    onExit(): void;
}

interface Bystander {
    model: CharacterModel;
    hopTimer: number;
    y: number;
    vy: number;
}

const ISLAND_RADIUS = 14;
const SPAWN = new THREE.Vector3(0, 0, 5);
const KILL_HEIGHT = -14;

/**
 * Free-play practice island. Exercises the shared character controller,
 * camera rig, collision world and effects before any minigame exists.
 */
export class PlaygroundScene implements GameScene {
    readonly scene = new THREE.Scene();
    readonly rig = new CameraRig({ distance: 10, height: 6, lookHeight: 1.2 });
    readonly camera = this.rig.camera;

    private readonly world = new StaticWorld();
    private readonly player: CharacterController;
    private readonly bystanders: Bystander[] = [];
    private readonly effects: Effects;
    private readonly lighting: Lighting;
    private readonly clouds: CloudLayer;
    private readonly hud: PlaygroundHud;
    private readonly cameraTarget = new THREE.Vector3();
    private highestPoint = 0;

    constructor(private readonly game: Game, private readonly options: PlaygroundOptions) {
        this.scene.add(createSky());
        this.lighting = createLighting(this.scene, 16);
        this.clouds = createCloudLayer(18, 35, 90, -20, 12);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);

        this.buildIsland();
        this.buildCourse();
        this.buildBystanders();

        const model = new CharacterModel(options.character, options.hat);
        this.scene.add(model.root);
        this.player = new CharacterController(model, this.world, SPAWN);
        this.player.teleport(SPAWN, Math.PI);

        this.hud = new PlaygroundHud(game.uiRoot, { characterName: options.character.name, onExit: options.onExit });
        this.rig.snap(this.player.position);
    }

    enter(): void {
        this.hud.mount();
        this.game.input.setGameplayControls(true, 'Dash');
        this.game.input.setDragToLook(true);
        window.addEventListener('keydown', this.onKeyDown);
    }

    exit(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.game.input.setGameplayControls(false);
        this.game.input.setDragToLook(false);
        this.hud.unmount();
    }

    resize(width: number, height: number): void {
        this.rig.resize(width, height);
    }

    update(dt: number): void {
        const input = this.game.input.snapshot;
        this.rig.rotate(input.lookX, input.lookY);

        const events = this.player.update(dt, input, this.rig.getYaw());
        const feet = this.player.position;

        if (events.jumped) {
            this.effects.jump(feet);
        }
        if (events.landed) {
            this.effects.landing(feet, events.landingSpeed);
            if (events.landingSpeed > 18) {
                this.rig.shake(0.5);
            }
        }
        if (events.dashed) {
            this.effects.dash(feet.clone().setY(feet.y + 0.4), this.options.character.body);
        }

        this.trackHeight();

        if (feet.y < KILL_HEIGHT) {
            this.respawn();
        }

        // Follow the player, but don't dive into the void with them.
        this.cameraTarget.copy(feet);
        this.cameraTarget.y = Math.max(feet.y, -2);
        this.rig.setTarget(this.cameraTarget);
        this.rig.update(dt);
        this.lighting.follow(this.cameraTarget);

        this.updateBystanders(dt);
        this.clouds.update(dt);
        this.effects.update(dt);
    }

    private trackHeight(): void {
        const { grounded, position } = this.player.state;

        if (grounded && position.y > this.highestPoint + 0.5 && position.y >= 3) {
            this.highestPoint = position.y;
            this.hud.showToast(position.y >= 6 ? 'Top of the tower!' : 'Nice climb!');
            this.effects.confetti(this.player.position.clone().setY(position.y + 1.5), 40);
        }
    }

    private respawn(): void {
        this.player.teleport(SPAWN, Math.PI);
        this.rig.snap(SPAWN);
        this.effects.poof(SPAWN.clone().setY(0.6));
        this.hud.showToast('Whoops! Back you go');
    }

    private buildIsland(): void {
        const island = createIsland(ISLAND_RADIUS, 1.6);
        this.scene.add(island);
        this.world.addCylinder(0, -2.1, 0, ISLAND_RADIUS, 2.1);

        for (let index = 0; index < 70; index++) {
            const flower = createFlower();
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * (ISLAND_RADIUS - 1);
            flower.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
            this.scene.add(flower);
        }

        const trees: [number, number, number][] = [
            [-9, -5, 2.6],
            [-10.5, 2, 2.2],
            [-6, -9.5, 2.4],
            [9.5, 6, 2.3],
            [3, -11, 2.8],
            [-4, 10.5, 2.1],
        ];
        for (const [x, z, height] of trees) {
            const tree = createTree(height);
            tree.position.set(x, 0, z);
            tree.rotation.y = randomRange(0, Math.PI * 2);
            this.scene.add(tree);
            this.world.addCylinder(x, 0, z, 0.35, height, { walkable: false });
        }

        // A second little island to jump to.
        const islet = createIsland(3, 0.8);
        islet.position.set(0, 0.8, -19.5);
        this.scene.add(islet);
        this.world.addCylinder(0, -0.9, -19.5, 3, 1.7);
    }

    /** Toy-block staircase leading up to floating platforms. */
    private buildCourse(): void {
        const steps: [number, number, number, number][] = [
            [6, 0, 0.6, palette.coral],
            [7.4, -1.2, 1.2, palette.tangerine],
            [8.2, -2.9, 1.8, palette.sun],
            [8, -4.8, 2.4, palette.mint],
        ];

        for (const [x, z, height, color] of steps) {
            this.addBlock(new THREE.Vector3(x, height / 2, z), new THREE.Vector3(1.8, height, 1.8), color);
        }

        const platforms: [number, number, number, number][] = [
            [6, 3.4, -6.8, palette.sky],
            [3.4, 4.4, -7.6, palette.grape],
            [0.6, 5.4, -6.6, palette.bubblegum],
            [-2, 6.4, -5, palette.coral],
        ];

        for (const [x, top, z, color] of platforms) {
            this.addBlock(new THREE.Vector3(x, top - 0.25, z), new THREE.Vector3(2.2, 0.5, 2.2), color);
        }

        // Scattered blocks to hop over and around.
        this.addBlock(new THREE.Vector3(-5, 0.4, 3), new THREE.Vector3(1.2, 0.8, 1.2), palette.sky);
        this.addBlock(new THREE.Vector3(-3.4, 0.4, 4.8), new THREE.Vector3(1.2, 0.8, 1.2), palette.sun);
        this.addBlock(new THREE.Vector3(-6.4, 0.7, 5.6), new THREE.Vector3(1.4, 1.4, 1.4), palette.mint);
    }

    private addBlock(center: THREE.Vector3, size: THREE.Vector3, color: number): void {
        const block = createBlock(size.x, size.y, size.z, color);
        block.position.copy(center);
        this.scene.add(block);
        this.world.addBox(center, size);
    }

    private buildBystanders(): void {
        const others = ROSTER.filter((character) => character.id !== this.options.character.id);
        const spots: [number, number][] = [
            [-2.5, -1.5],
            [0, -3],
            [2.5, -1.5],
        ];

        others.forEach((definition, index) => {
            const [x, z] = spots[index];
            const model = new CharacterModel(definition);
            model.root.position.set(x, 0, z);
            this.scene.add(model.root);
            // Solid, so they can be bumped into and even stood on.
            this.world.addCylinder(x, 0, z, 0.45, 1.15);
            this.bystanders.push({ model, hopTimer: randomRange(1, 4), y: 0, vy: 0 });
        });
    }

    private updateBystanders(dt: number): void {
        const playerPosition = this.player.position;

        for (const bystander of this.bystanders) {
            const root = bystander.model.root;
            const facing = Math.atan2(playerPosition.x - root.position.x, playerPosition.z - root.position.z);
            root.rotation.y += angleDelta(root.rotation.y, facing) * damp(4, dt);

            bystander.hopTimer -= dt;
            if (bystander.y === 0 && bystander.hopTimer <= 0) {
                bystander.vy = randomRange(5, 7);
                bystander.hopTimer = randomRange(2, 5);
                bystander.model.jump();
            }

            if (bystander.vy !== 0 || bystander.y > 0) {
                bystander.vy -= 30 * dt;
                bystander.y = Math.max(0, bystander.y + bystander.vy * dt);
                if (bystander.y === 0) {
                    bystander.model.land(Math.abs(bystander.vy));
                    bystander.vy = 0;
                }
            }

            root.position.y = bystander.y;
            bystander.model.update(dt, { speed: 0, grounded: bystander.y === 0, verticalVelocity: bystander.vy });
        }
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Escape') {
            this.options.onExit();
        }
    };
}
