import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import { CameraRig } from '../../core/CameraRig';
import type { InputSnapshot } from '../../core/InputManager';
import { CharacterController } from '../../characters/CharacterController';
import { CharacterModel } from '../../characters/CharacterModel';
import { createNameTag } from '../../characters/NameTag';
import { createCloudLayer, createLighting, createSky, type CloudLayer } from '../../design/environment';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette, partyColors } from '../../design/palette';
import { Effects } from '../../effects/Effects';
import { RemoteCharacters } from '../../multiplayer/RemoteCharacters';
import { SnapshotSender } from '../../multiplayer/SnapshotSender';
import { StaticWorld } from '../../world/StaticWorld';
import { WorldWithMovingObstacles } from '../../world/WorldWithMovingObstacles';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { ARENA_RADIUS, claimWins, planToys, TOY_TYPES, type ToyPlan } from './rules';
import { createToy, createVacuum } from './toys';

const NEUTRAL: InputSnapshot = { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, actionPressed: false, actionHeld: false, lookX: 0, lookY: 0 };
const SUCTION_RANGE = 3.4;
const SUCTION_HALF_ANGLE = Math.PI / 4;
const NOZZLE_DISTANCE = 0.95;
const CAPTURE_DISTANCE = 0.55;
/** How long a claim is repeated in snapshots so others are sure to see it. */
const CLAIM_BROADCAST_MS = 2500;
const SPAWNS = [
    [0, 4],
    [-4, 0],
    [4, 0],
    [0, -4],
];

interface Toy {
    plan: ToyPlan;
    mesh: THREE.Group;
    x: number;
    z: number;
    progress: number;
    spawnPop: number;
}

interface Claim {
    toyId: number;
    playerId: number;
    time: number;
}

/**
 * Vacuum Chaos: hold the action button to suck up toys in front of you.
 * Big toys are worth more but take longer and slow you down.
 */
class VacuumChaos implements Minigame {
    readonly scene = new THREE.Scene();
    private readonly rig = new CameraRig({ distance: 10, height: 15, lookHeight: 0, rotateSpeed: 0, followSharpness: 3 });
    readonly camera = this.rig.camera;

    private readonly world = new StaticWorld();
    private readonly plans: ToyPlan[];
    private readonly toys = new Map<number, Toy>();
    private readonly claims = new Map<number, Claim>();
    private readonly myPoints = new Map<number, number>();
    private readonly player: CharacterController;
    private readonly vacuum: THREE.Group;
    private readonly effects: Effects;
    private readonly clouds: CloudLayer;
    private readonly remotes: RemoteCharacters | null = null;
    private readonly snapshots: SnapshotSender | null = null;
    private readonly unsubscribe: (() => void) | null = null;
    private readonly cameraTarget = new THREE.Vector3();
    private nextSpawn = 0;
    private time = 0;
    private score = 0;
    private sucking = false;
    private suckParticleTimer = 0;
    private collected = { small: 0, medium: 0, large: 0 };
    private stolen = 0;

    constructor(private readonly context: MinigameContext) {
        this.plans = planToys(context.seed);

        this.scene.add(createSky());
        createLighting(this.scene, 15);
        this.clouds = createCloudLayer(16, 30, 80, -12, 12);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);
        this.buildPlayroom();

        const network = context.network;
        const [spawnX, spawnZ] = SPAWNS[(network?.localSeat ?? 0) % SPAWNS.length];
        const model = new CharacterModel(context.character, context.hat);
        this.vacuum = createVacuum(context.character.feet);
        model.root.add(this.vacuum);
        this.scene.add(model.root);

        if (network) {
            this.remotes = new RemoteCharacters(this.scene, network, (position) => this.effects.poof(position));
            this.snapshots = new SnapshotSender(network);
            model.root.add(createNameTag('You', context.character.body, true, 1.6));
            this.unsubscribe = network.onSnapshot((playerId, snapshot) => this.receiveClaims(playerId, snapshot.e));
        }

        const world = this.remotes ? new WorldWithMovingObstacles(this.world, () => this.remotes?.obstacles() ?? []) : this.world;
        const spawn = new THREE.Vector3(network ? spawnX : 0, 0, network ? spawnZ : 2);
        this.player = new CharacterController(model, world, spawn);
        this.player.teleport(spawn, Math.PI);
        this.spawnToys(0);
        this.updateCamera(0, true);
    }

    start(): void {
        this.time = 0;
    }

    getScore(): number {
        return this.score;
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        const playing = elapsed !== null;

        if (playing) {
            this.time = elapsed;
            this.spawnToys(this.time);
        }

        // The action button is the vacuum here, so it must not trigger a dash.
        const controls = playing ? { ...input, actionPressed: false } : NEUTRAL;
        this.sucking = playing && input.actionHeld;

        const slowdown = this.sucking ? this.heaviestInNozzle() : 1;
        this.player.config.maxSpeed = 6.5 * slowdown;

        const events = this.player.update(dt, controls, this.rig.getYaw());
        if (events.landed) {
            this.effects.landing(this.player.position, events.landingSpeed);
        }

        this.updateSuction(dt);
        this.updateToys(dt);
        this.remotes?.update(dt);
        this.snapshots?.update(dt, this.player, false, this.score, () => this.claimPayload());
        this.updateCamera(dt, false);
        this.clouds.update(dt);
        this.effects.update(dt);
    }

    isOver(): boolean {
        return false;
    }

    getResult(): MinigameResult {
        const stats = [
            { label: 'Small toys', value: String(this.collected.small) },
            { label: 'Medium toys', value: String(this.collected.medium) },
            { label: 'Big toys', value: String(this.collected.large) },
        ];

        if (this.stolen > 0) {
            stats.push({ label: 'Snatched by others', value: String(this.stolen) });
        }

        return { score: this.score, title: this.score >= 600 ? 'Spotless!' : 'Squeaky clean!', stats };
    }

    resize(width: number, height: number): void {
        this.rig.resize(width, height);

        if (width < height) {
            this.rig.setFraming(18, 26);
        } else {
            this.rig.setFraming(10, 15);
        }
    }

    dispose(): void {
        this.unsubscribe?.();
        this.remotes?.dispose();
    }

    private spawnToys(time: number): void {
        while (this.nextSpawn < this.plans.length && this.plans[this.nextSpawn].spawnAt <= time) {
            const plan = this.plans[this.nextSpawn++];

            if (this.claims.has(plan.id)) {
                continue;
            }

            const mesh = createToy(plan);
            mesh.position.set(plan.x, 0, plan.z);
            this.scene.add(mesh);
            this.toys.set(plan.id, { plan, mesh, x: plan.x, z: plan.z, progress: 0, spawnPop: time > 0 ? 1 : 0 });

            if (time > 0 && plan.kind === 'large') {
                this.effects.poof(new THREE.Vector3(plan.x, 0.5, plan.z));
            }
        }
    }

    private nozzle(): THREE.Vector3 {
        const { position, facing } = this.player.state;
        return new THREE.Vector3(position.x + Math.sin(facing) * NOZZLE_DISTANCE, 0, position.z + Math.cos(facing) * NOZZLE_DISTANCE);
    }

    /** Toys inside the suction cone, and whether they are right at the nozzle. */
    private toysInCone(): { toy: Toy; distance: number }[] {
        const nozzle = this.nozzle();
        const facing = this.player.state.facing;
        const result: { toy: Toy; distance: number }[] = [];

        for (const toy of this.toys.values()) {
            const dx = toy.x - nozzle.x;
            const dz = toy.z - nozzle.z;
            const distance = Math.hypot(dx, dz);

            if (distance > SUCTION_RANGE) {
                continue;
            }

            const angle = Math.atan2(dx, dz);
            const offset = Math.abs(Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing)));

            if (distance < CAPTURE_DISTANCE * 1.5 || offset < SUCTION_HALF_ANGLE) {
                result.push({ toy, distance });
            }
        }

        return result;
    }

    private heaviestInNozzle(): number {
        let slowdown = 1;

        for (const { toy, distance } of this.toysInCone()) {
            if (distance < CAPTURE_DISTANCE * 1.5) {
                slowdown = Math.min(slowdown, TOY_TYPES[toy.plan.kind].slowdown);
            }
        }

        return slowdown;
    }

    private updateSuction(dt: number): void {
        this.vacuum.position.z = this.sucking ? Math.sin(this.time * 60) * 0.02 : 0;

        if (!this.sucking) {
            for (const toy of this.toys.values()) {
                toy.progress = Math.max(0, toy.progress - dt);
            }
            return;
        }

        const nozzle = this.nozzle();

        this.suckParticleTimer -= dt;
        if (this.suckParticleTimer <= 0) {
            this.suckParticleTimer = 0.08;
            const facing = this.player.state.facing;
            const spread = (Math.random() - 0.5) * 1.4;
            const from = new THREE.Vector3(nozzle.x + Math.sin(facing + spread) * 2.6, 0.5, nozzle.z + Math.cos(facing + spread) * 2.6);
            this.effects.jump(from);
        }

        for (const { toy, distance } of this.toysInCone()) {
            const type = TOY_TYPES[toy.plan.kind];

            if (distance > CAPTURE_DISTANCE) {
                const pull = Math.min(distance - CAPTURE_DISTANCE * 0.8, type.pullSpeed * dt * (1.4 - distance / SUCTION_RANGE));
                toy.x += ((nozzle.x - toy.x) / distance) * pull;
                toy.z += ((nozzle.z - toy.z) / distance) * pull;
                continue;
            }

            toy.progress += dt;

            if (toy.progress >= type.suckTime) {
                this.collect(toy);
            }
        }
    }

    private collect(toy: Toy): void {
        const type = TOY_TYPES[toy.plan.kind];
        this.removeToy(toy.plan.id);
        this.claims.set(toy.plan.id, { toyId: toy.plan.id, playerId: this.myId(), time: this.now() });
        this.myPoints.set(toy.plan.id, type.points);
        this.score += type.points;
        this.collected[toy.plan.kind]++;
        this.context.hud.setScore(this.score);
        audio.play(toy.plan.kind === 'large' ? 'bonus' : 'collect');

        if (toy.plan.kind !== 'small') {
            this.context.hud.callout(`+${type.points}`, 'good');
            this.effects.confetti(this.player.position.clone().setY(1.6), toy.plan.kind === 'large' ? 40 : 15);
        }
    }

    private removeToy(id: number): void {
        const toy = this.toys.get(id);

        if (toy) {
            this.scene.remove(toy.mesh);
            this.toys.delete(id);
        }
    }

    private updateToys(dt: number): void {
        for (const toy of this.toys.values()) {
            toy.spawnPop = Math.max(0, toy.spawnPop - dt * 3);
            const shake = toy.progress > 0 ? (Math.random() - 0.5) * 0.08 : 0;
            const growing = toy.progress > 0 ? 1 - Math.min(0.5, toy.progress / Math.max(0.2, TOY_TYPES[toy.plan.kind].suckTime)) * 0.5 : 1;
            toy.mesh.position.set(toy.x + shake, Math.sin(toy.spawnPop * Math.PI) * 1.2, toy.z + shake);
            toy.mesh.scale.setScalar((1 - toy.spawnPop * 0.5) * growing);
        }
    }

    /** Claims made in the last few seconds, flattened as [toyId, time, ...]. */
    private claimPayload(): number[] {
        const now = this.now();
        const payload: number[] = [];

        for (const claim of this.claims.values()) {
            if (claim.playerId === this.myId() && now - claim.time < CLAIM_BROADCAST_MS) {
                payload.push(claim.toyId, claim.time);
            }
        }

        return payload;
    }

    private receiveClaims(playerId: number, payload: number[] | undefined): void {
        if (!payload) {
            return;
        }

        for (let index = 0; index + 1 < payload.length; index += 2) {
            const toyId = payload[index];
            const time = payload[index + 1];
            const existing = this.claims.get(toyId);

            if (existing && !claimWins(time, playerId, existing.time, existing.playerId)) {
                continue;
            }

            if (existing?.playerId === this.myId()) {
                this.revoke(toyId);
            }

            this.claims.set(toyId, { toyId, playerId, time });
            const toy = this.toys.get(toyId);
            if (toy) {
                this.effects.poof(new THREE.Vector3(toy.x, 0.4, toy.z));
                this.removeToy(toyId);
            }
        }
    }

    /** Someone else grabbed it first: take the points back. */
    private revoke(toyId: number): void {
        const points = this.myPoints.get(toyId) ?? 0;
        this.myPoints.delete(toyId);
        this.score = Math.max(0, this.score - points);
        this.stolen++;
        this.context.hud.setScore(this.score);
        this.context.hud.callout('Snatched!', 'bad');
    }

    private myId(): number {
        return this.context.network?.localPlayerId ?? 0;
    }

    private now(): number {
        return this.context.network ? this.context.network.serverNow() : this.time * 1000;
    }

    private buildPlayroom(): void {
        const rug = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 0.5, ARENA_RADIUS + 0.5, 1, 64), toonMaterial(0xfde7c8));
        rug.position.y = -0.5;
        rug.receiveShadow = true;
        this.scene.add(rug);
        this.world.addCylinder(0, -1, 0, ARENA_RADIUS + 0.5, 1);

        [ARENA_RADIUS - 2, ARENA_RADIUS - 5, ARENA_RADIUS - 8].forEach((radius, index) => {
            const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.6, radius, 64), toonMaterial(partyColors[index + 1]));
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.01;
            ring.receiveShadow = true;
            this.scene.add(ring);
        });

        const blockCount = 28;
        for (let index = 0; index < blockCount; index++) {
            const angle = (index / blockCount) * Math.PI * 2;
            const height = index % 3 === 0 ? 1.6 : 1.1;
            const block = new THREE.Mesh(new THREE.BoxGeometry(2.4, height, 1.2), toonMaterial(partyColors[index % partyColors.length]));
            const x = Math.cos(angle) * (ARENA_RADIUS + 0.9);
            const z = Math.sin(angle) * (ARENA_RADIUS + 0.9);
            block.position.set(x, height / 2, z);
            block.rotation.y = -angle + Math.PI / 2;
            block.castShadow = true;
            addOutline(block);
            this.scene.add(block);
        }

        // One round wall collider just inside the toy blocks.
        for (let index = 0; index < 48; index++) {
            const angle = (index / 48) * Math.PI * 2;
            this.world.addCylinder(Math.cos(angle) * (ARENA_RADIUS + 1.1), 0, Math.sin(angle) * (ARENA_RADIUS + 1.1), 0.9, 3, { walkable: false });
        }

        const base = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 2, ARENA_RADIUS, 3, 48), toonMaterial(palette.dirt));
        base.position.y = -2.4;
        this.scene.add(base);
    }

    private updateCamera(dt: number, snap: boolean): void {
        const feet = this.player.position;
        this.cameraTarget.set(feet.x * 0.35, 0, feet.z * 0.3 + 1);

        if (snap) {
            this.rig.snap(this.cameraTarget);
            return;
        }

        this.rig.setTarget(this.cameraTarget);
        this.rig.update(dt);
    }
}

export const createVacuumChaos: MinigameFactory = (context) => new VacuumChaos(context);
