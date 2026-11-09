import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import { CameraRig } from '../../core/CameraRig';
import type { InputSnapshot } from '../../core/InputManager';
import { CharacterController } from '../../characters/CharacterController';
import { CharacterModel } from '../../characters/CharacterModel';
import { createNameTag } from '../../characters/NameTag';
import { createCloudLayer, createLighting, createSky, type CloudLayer, type Lighting } from '../../design/environment';
import { Effects } from '../../effects/Effects';
import { RemoteCharacters } from '../../multiplayer/RemoteCharacters';
import { SnapshotSender } from '../../multiplayer/SnapshotSender';
import { StaticWorld } from '../../world/StaticWorld';
import { WorldWithMovingObstacles, type MovingObstacle } from '../../world/WorldWithMovingObstacles';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { pushBall, stepBall, type BallState, type Bounds, type Circle } from './ball';
import { buildCourse, createBallMesh, END_Z, START_Z } from './Course';
import { BALL_RADIUS, COURSE_LENGTH, HALF_WIDTH, planCourse, progressAt, scoreFor, type Obstacle } from './rules';

const NEUTRAL: InputSnapshot = { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, actionPressed: false, actionHeld: false, lookX: 0, lookY: 0 };
const LANES = [-3.6, -1.2, 1.2, 3.6];

interface RemoteBall {
    mesh: THREE.Mesh;
    target: THREE.Vector2;
    current: THREE.Vector2;
    seen: boolean;
}

/** Big Ball: push your giant ball through the obstacle course to the finish. */
class BigBall implements Minigame {
    readonly scene = new THREE.Scene();
    private readonly rig = new CameraRig({ distance: 9, height: 8, lookHeight: 0.5, rotateSpeed: 0, followSharpness: 4 });
    readonly camera = this.rig.camera;

    private readonly world = new StaticWorld();
    private readonly obstacles: Obstacle[];
    private readonly bounds: Bounds = { minX: -HALF_WIDTH, maxX: HALF_WIDTH, minZ: END_Z, maxZ: START_Z };
    private readonly ball: BallState;
    private readonly ballMesh: THREE.Mesh;
    private readonly player: CharacterController;
    private readonly effects: Effects;
    private readonly lighting: Lighting;
    private readonly clouds: CloudLayer;
    private readonly remotes: RemoteCharacters | null = null;
    private readonly snapshots: SnapshotSender | null = null;
    private readonly remoteBalls = new Map<number, RemoteBall>();
    private readonly unsubscribe: (() => void) | null = null;
    private readonly cameraTarget = new THREE.Vector3();
    private time = 0;
    private finishTime: number | null = null;
    private bestProgress = 0;
    private halfwayCalled = false;
    private bumpCooldown = 0;

    constructor(private readonly context: MinigameContext) {
        this.obstacles = planCourse(context.seed);

        this.scene.add(createSky());
        this.lighting = createLighting(this.scene, 14);
        this.clouds = createCloudLayer(18, 40, 90, -20, 10);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);
        buildCourse(this.scene, this.world, this.obstacles);

        const network = context.network;
        const lane = LANES[(network?.localSeat ?? 1) % LANES.length] * (network ? 1 : 0);
        this.ball = { x: lane, z: -BALL_RADIUS - 0.4, vx: 0, vz: 0, radius: BALL_RADIUS };
        this.ballMesh = createBallMesh(context.character.body);
        this.ballMesh.scale.setScalar(BALL_RADIUS);
        this.scene.add(this.ballMesh);

        const model = new CharacterModel(context.character, context.hat);
        this.scene.add(model.root);

        if (network) {
            this.remotes = new RemoteCharacters(this.scene, network, (position) => this.effects.poof(position));
            this.snapshots = new SnapshotSender(network);
            model.root.add(createNameTag('You', context.character.body, true, 1.4));

            for (const remote of network.remotePlayers) {
                const mesh = createBallMesh(remote.character.body);
                mesh.scale.setScalar(BALL_RADIUS);
                mesh.visible = false;
                this.scene.add(mesh);
                this.remoteBalls.set(remote.id, { mesh, target: new THREE.Vector2(), current: new THREE.Vector2(), seen: false });
            }

            this.unsubscribe = network.onSnapshot((playerId, snapshot) => {
                const remote = this.remoteBalls.get(playerId);
                if (remote && snapshot.e && snapshot.e.length >= 2) {
                    remote.target.set(snapshot.e[0], snapshot.e[1]);
                    if (!remote.seen) {
                        remote.current.copy(remote.target);
                        remote.seen = true;
                    }
                }
            });
        }

        const world = new WorldWithMovingObstacles(this.world, () => this.movingObstacles());
        const spawn = new THREE.Vector3(lane, 0, 2.6);
        this.player = new CharacterController(model, world, spawn);
        this.player.teleport(spawn, Math.PI);
        this.syncBallMesh(0);
        this.updateCamera(0, true);
    }

    start(): void {
        this.time = 0;
    }

    getScore(): number {
        return scoreFor(this.bestProgress, this.finishTime);
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        const playing = elapsed !== null;

        if (playing) {
            this.time = elapsed;
        }

        const events = this.player.update(dt, playing ? input : NEUTRAL, this.rig.getYaw());
        if (events.landed) {
            this.effects.landing(this.player.position, events.landingSpeed);
        }
        if (events.dashed) {
            this.effects.dash(this.player.position.clone().setY(0.4), this.context.character.body);
        }

        this.updateBall(dt, playing);
        this.updateRemoteBalls(dt);
        this.remotes?.update(dt);
        this.snapshots?.update(dt, this.player, false, this.getScore(), () => [Math.round(this.ball.x * 100) / 100, Math.round(this.ball.z * 100) / 100]);
        this.updateCamera(dt, false);
        this.clouds.update(dt);
        this.effects.update(dt);
    }

    isOver(): boolean {
        return this.finishTime !== null;
    }

    getResult(): MinigameResult {
        return {
            score: this.getScore(),
            title: this.finishTime !== null ? 'Goal!' : 'So close!',
            stats: [
                { label: 'Finish time', value: this.finishTime !== null ? `${this.finishTime.toFixed(2)}s` : 'Did not finish' },
                { label: 'Course covered', value: `${Math.round(this.bestProgress * 100)}%` },
            ],
        };
    }

    resize(width: number, height: number): void {
        this.rig.resize(width, height);

        if (width < height) {
            this.rig.setFraming(13, 12);
        } else {
            this.rig.setFraming(9, 8);
        }
    }

    dispose(): void {
        this.unsubscribe?.();
        this.remotes?.dispose();
    }

    private updateBall(dt: number, playing: boolean): void {
        const state = this.player.state;

        if (playing && this.finishTime === null) {
            const correction = pushBall(this.ball, { x: state.position.x, z: state.position.z, radius: this.player.config.radius }, state.velocity.x, state.velocity.z, state.dashTimer > 0 ? 1.5 : 1.15);
            if (correction) {
                state.position.x += correction.x;
                state.position.z += correction.z;
            }
        }

        const before = this.ball.z;
        const ballEvents = stepBall(this.ball, dt, this.obstacles, this.remoteBallCircles(), this.bounds);
        this.bumpCooldown -= dt;

        if (ballEvents.bumped && this.bumpCooldown <= 0) {
            this.bumpCooldown = 0.2;
            audio.play('bump', 1.2);
            this.effects.poof(new THREE.Vector3(this.ball.x, 0.8, this.ball.z));
            this.rig.shake(0.25);
        }
        if (ballEvents.hitWall > 3 && this.bumpCooldown <= 0) {
            this.bumpCooldown = 0.2;
            audio.play('bump', ballEvents.hitWall / 8);
        }

        if (playing && this.finishTime === null) {
            this.bestProgress = Math.max(this.bestProgress, progressAt(this.ball.z));

            if (!this.halfwayCalled && this.bestProgress >= 0.5) {
                this.halfwayCalled = true;
                this.context.hud.callout('Halfway!', 'neutral');
            }

            if (before > -COURSE_LENGTH && this.ball.z <= -COURSE_LENGTH) {
                this.finish();
            }
        }

        this.syncBallMesh(dt);
    }

    private finish(): void {
        this.finishTime = this.time;
        this.bestProgress = 1;
        this.context.hud.setScore(this.getScore());
        this.context.hud.callout(`Goal! ${this.finishTime.toFixed(1)}s`, 'good');
        audio.play('win');
        for (let index = 0; index < 3; index++) {
            this.effects.confetti(new THREE.Vector3((index - 1) * 4, 4, -COURSE_LENGTH), 50);
        }
    }

    /** Rolls the mesh: rotation axis is perpendicular to the direction of travel. */
    private syncBallMesh(dt: number): void {
        const speed = Math.hypot(this.ball.vx, this.ball.vz);

        if (speed > 0.01 && dt > 0) {
            const axis = new THREE.Vector3(this.ball.vz, 0, -this.ball.vx).normalize();
            const rotation = new THREE.Quaternion().setFromAxisAngle(axis, (speed * dt) / BALL_RADIUS);
            this.ballMesh.quaternion.premultiply(rotation);
        }

        this.ballMesh.position.set(this.ball.x, BALL_RADIUS, this.ball.z);
    }

    private updateRemoteBalls(dt: number): void {
        for (const remote of this.remoteBalls.values()) {
            if (!remote.seen) {
                continue;
            }

            const before = remote.current.clone();
            remote.current.lerp(remote.target, 1 - Math.exp(-12 * dt));
            const moved = remote.current.clone().sub(before);
            const distance = moved.length();

            if (distance > 1e-4) {
                const axis = new THREE.Vector3(moved.y, 0, -moved.x).normalize();
                remote.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, distance / BALL_RADIUS));
            }

            remote.mesh.visible = true;
            remote.mesh.position.set(remote.current.x, BALL_RADIUS, remote.current.y);
        }
    }

    private remoteBallCircles(): Circle[] {
        return [...this.remoteBalls.values()].filter((remote) => remote.seen).map((remote) => ({ x: remote.current.x, z: remote.current.y, radius: BALL_RADIUS }));
    }

    /** Things the local character bumps into: other players and every ball. */
    private movingObstacles(): MovingObstacle[] {
        const others = this.remotes?.obstacles() ?? [];
        const balls = this.remoteBallCircles().map((circle) => ({ x: circle.x, y: 0, z: circle.z, radius: circle.radius }));

        return [...others, ...balls];
    }

    private updateCamera(dt: number, snap: boolean): void {
        const feet = this.player.position;
        this.cameraTarget.set((this.ball.x + feet.x) * 0.35, 0, (this.ball.z * 0.6 + feet.z * 0.4) - 1.5);
        this.lighting.follow(this.cameraTarget);

        if (snap) {
            this.rig.snap(this.cameraTarget);
            return;
        }

        this.rig.setTarget(this.cameraTarget);
        this.rig.update(dt);
    }
}

export const createBigBall: MinigameFactory = (context) => new BigBall(context);
