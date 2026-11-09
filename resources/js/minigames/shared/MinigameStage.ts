import * as THREE from 'three';
import { CameraRig } from '../../core/CameraRig';
import type { InputSnapshot } from '../../core/InputManager';
import { CharacterController } from '../../characters/CharacterController';
import { CharacterModel } from '../../characters/CharacterModel';
import { createNameTag } from '../../characters/NameTag';
import type { MovementEvents } from '../../characters/movement';
import { createCloudLayer, createLighting, createSky, type CloudLayer, type Lighting } from '../../design/environment';
import { Effects } from '../../effects/Effects';
import { RemoteCharacters } from '../../multiplayer/RemoteCharacters';
import { SnapshotSender } from '../../multiplayer/SnapshotSender';
import type { StaticWorld } from '../../world/StaticWorld';
import { WorldWithMovingObstacles, type MovingObstacle } from '../../world/WorldWithMovingObstacles';
import type { MinigameContext } from '../types';

export const NEUTRAL_INPUT: InputSnapshot = { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, actionPressed: false, actionHeld: false, lookX: 0, lookY: 0 };

export interface Framing {
    distance: number;
    height: number;
    portraitDistance: number;
    portraitHeight: number;
}

export interface MinigameStageOptions {
    world: StaticWorld;
    /** Spawn point for a seat (seat 0 in solo). */
    spawn(seat: number): THREE.Vector3;
    framing: Framing;
    shadowSize?: number;
    nameTagSize?: number;
    /** Extra solid things the local player bumps into (besides other players). */
    obstacles?: () => MovingObstacle[];
}

/**
 * The parts every arena minigame shares: sky and light, the local player,
 * other players, snapshots and a fixed-angle follow camera. A minigame
 * builds its world and rules on top of this.
 */
export class MinigameStage {
    readonly scene = new THREE.Scene();
    readonly rig: CameraRig;
    readonly effects: Effects;
    readonly player: CharacterController;
    readonly remotes: RemoteCharacters | null = null;
    private readonly snapshots: SnapshotSender | null = null;
    private readonly lighting: Lighting;
    private readonly clouds: CloudLayer;
    private readonly cameraTarget = new THREE.Vector3();

    constructor(
        private readonly context: MinigameContext,
        private readonly options: MinigameStageOptions,
    ) {
        this.scene.add(createSky());
        this.lighting = createLighting(this.scene, options.shadowSize ?? 14);
        this.clouds = createCloudLayer(16, 35, 85, -16, 12);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);
        this.rig = new CameraRig({ distance: options.framing.distance, height: options.framing.height, lookHeight: 0, rotateSpeed: 0, followSharpness: 3.5 });

        const model = new CharacterModel(context.character, context.hat);
        this.scene.add(model.root);

        if (context.network) {
            this.remotes = new RemoteCharacters(this.scene, context.network, (position) => this.effects.poof(position));
            this.snapshots = new SnapshotSender(context.network);
            model.root.add(createNameTag('You', context.character.body, true, options.nameTagSize ?? 1.6));
        }

        const world = new WorldWithMovingObstacles(options.world, () => [...(this.remotes?.obstacles() ?? []), ...(options.obstacles?.() ?? [])]);
        const spawn = options.spawn(context.network?.localSeat ?? 0);
        this.player = new CharacterController(model, world, spawn);
        this.player.teleport(spawn, Math.PI);
    }

    get camera(): THREE.PerspectiveCamera {
        return this.rig.camera;
    }

    get position(): THREE.Vector3 {
        return this.player.position;
    }

    /** Moves the local player with standard dust and dash effects. */
    movePlayer(dt: number, input: InputSnapshot, playing: boolean, allowDash = true): MovementEvents {
        const controls = playing ? (allowDash ? input : { ...input, actionPressed: false }) : NEUTRAL_INPUT;
        const events = this.player.update(dt, controls, this.rig.getYaw());

        if (events.landed) {
            this.effects.landing(this.player.position, events.landingSpeed);
        }
        if (events.dashed) {
            this.effects.dash(this.player.position.clone().setY(this.player.position.y + 0.4), this.context.character.body);
        }

        return events;
    }

    /** Remote players, snapshots, clouds and particles. Call once per frame. */
    updateShared(dt: number, score: number, out: boolean, extra?: () => number[]): void {
        this.remotes?.update(dt);
        this.snapshots?.update(dt, this.player, out, score, extra);
        this.clouds.update(dt);
        this.effects.update(dt);
    }

    follow(target: THREE.Vector3, dt: number, snap = false): void {
        this.cameraTarget.copy(target);
        this.lighting.follow(this.cameraTarget);

        if (snap) {
            this.rig.snap(this.cameraTarget);
            return;
        }

        this.rig.setTarget(this.cameraTarget);
        this.rig.update(dt);
    }

    resize(width: number, height: number): void {
        this.rig.resize(width, height);
        const { framing } = this.options;

        if (width < height) {
            this.rig.setFraming(framing.portraitDistance, framing.portraitHeight);
        } else {
            this.rig.setFraming(framing.distance, framing.height);
        }
    }

    dispose(): void {
        this.remotes?.dispose();
    }
}
