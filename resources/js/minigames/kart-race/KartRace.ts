import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '../../audio/AudioManager';
import { CameraRig } from '../../core/CameraRig';
import type { InputSnapshot } from '../../core/InputManager';
import { CharacterModel } from '../../characters/CharacterModel';
import { createNameTag } from '../../characters/NameTag';
import { createCloudLayer, createLighting, createSky, type CloudLayer, type Lighting } from '../../design/environment';
import { addOutline, createToonMaterial, toonMaterial } from '../../design/materials';
import { palette } from '../../design/palette';
import { Effects } from '../../effects/Effects';
import { RemoteCharacters } from '../../multiplayer/RemoteCharacters';
import { createTree } from '../../world/props';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { stepKart, type KartState } from './kart';
import { buildTrack, HALF_WIDTH, LAPS, nearestSample, planBoosts, SAMPLES, scoreFor, type BoostPad, type TrackPoint } from './track';

const SEND_INTERVAL = 0.11;
const KART_RADIUS = 1.1;
const SEAT_HEIGHT = 0.35;

/** A small kart body; the character sits in it. Forward is +z. */
function createKart(color: number): THREE.Group {
    const kart = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.45, 2.2, 2, 0.15), toonMaterial(color));
    body.position.y = 0.38;
    body.castShadow = true;
    addOutline(body);
    const nose = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.3, 0.5, 2, 0.12), toonMaterial(palette.white));
    nose.position.set(0, 0.35, 1.2);
    const spoiler = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.12, 0.35, 1, 0.05), toonMaterial(palette.ink));
    spoiler.position.set(0, 0.95, -1.05);
    kart.add(body, nose, spoiler);

    for (const [x, z] of [
        [0.8, 0.75],
        [-0.8, 0.75],
        [0.8, -0.75],
        [-0.8, -0.75],
    ]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 14), toonMaterial(palette.ink));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.3, z);
        wheel.name = 'wheel';
        kart.add(wheel);
    }

    return kart;
}

/**
 * Mini Kart Race: two laps round a little circuit. Grass slows you down,
 * yellow pads boost you. Each client drives its own kart; other karts are
 * solid but nobody can push someone else off.
 */
class KartRace implements Minigame {
    readonly scene = new THREE.Scene();
    private readonly rig = new CameraRig({ distance: 9.5, height: 6, lookHeight: 1.6, rotateSpeed: 0, followSharpness: 6 });
    readonly camera = this.rig.camera;

    private readonly track: TrackPoint[] = buildTrack();
    private readonly boosts: BoostPad[];
    private readonly kart: KartState;
    private readonly driver: CharacterModel;
    private readonly kartMesh: THREE.Group;
    private readonly effects: Effects;
    private readonly lighting: Lighting;
    private readonly clouds: CloudLayer;
    private readonly remotes: RemoteCharacters | null = null;
    private readonly checkpoints = new Set<number>();
    private trackIndex = 0;
    private lapsDone = 0;
    private finishTime: number | null = null;
    private time = 0;
    private sendTimer = 0;
    private boostCooldown = 0;
    private bumpCooldown = 0;
    private bestLap: number | null = null;
    private lapStartedAt = 0;

    constructor(private readonly context: MinigameContext) {
        this.boosts = planBoosts(context.seed);

        this.scene.add(createSky());
        this.lighting = createLighting(this.scene, 16);
        this.clouds = createCloudLayer(18, 40, 90, 8, 20);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);
        this.buildCircuit();

        // Starting grid: two by two behind the line.
        const seat = context.network?.localSeat ?? 0;
        const start = this.track[0];
        const back = 3 + Math.floor(seat / 2) * 3;
        const side = (seat % 2 === 0 ? -1 : 1) * 1.6 * (context.network ? 1 : 0);
        this.kart = {
            x: start.x - start.dx * back + start.dz * side,
            z: start.z - start.dz * back - start.dx * side,
            heading: Math.atan2(start.dx, start.dz),
            speed: 0,
            boost: 0,
        };

        this.driver = new CharacterModel(context.character, context.hat);
        this.kartMesh = createKart(context.character.body);
        this.kartMesh.position.y = -SEAT_HEIGHT;
        this.driver.root.add(this.kartMesh);
        this.scene.add(this.driver.root);

        if (context.network) {
            this.remotes = new RemoteCharacters(this.scene, context.network, (position) => this.effects.poof(position));
            this.driver.root.add(createNameTag('You', context.character.body, true, 1.3));

            for (const remote of context.network.remotePlayers) {
                const remoteKart = createKart(remote.character.body);
                remoteKart.position.y = -SEAT_HEIGHT;
                this.remotes.attach(remote.id, remoteKart);
            }
        }

        this.syncDriver(0);
        this.updateCamera(0, true);
    }

    start(): void {
        this.time = 0;
        this.lapStartedAt = 0;
    }

    getScore(): number {
        return scoreFor(this.lapsDone, this.trackIndex / SAMPLES, this.finishTime);
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        const playing = elapsed !== null;
        if (playing) {
            this.time = elapsed;
        }

        const racing = playing && this.finishTime === null;
        const { index, distance } = nearestSample(this.track, this.kart.x, this.kart.z, this.trackIndex);
        const previousIndex = this.trackIndex;
        this.trackIndex = index;
        const onTrack = distance <= HALF_WIDTH + 0.3;

        stepKart(this.kart, racing ? { throttle: input.actionHeld ? -1 : input.moveY, steer: input.moveX } : { throttle: 0, steer: 0 }, onTrack, dt);
        this.keepInBounds(distance);
        this.bumpKarts(dt);

        if (racing) {
            this.trackLaps(previousIndex, index);
            this.checkBoosts(dt);
        }

        if (!onTrack && Math.abs(this.kart.speed) > 4 && Math.random() < dt * 12) {
            this.effects.jump(new THREE.Vector3(this.kart.x, 0.2, this.kart.z));
        }

        this.syncDriver(dt);
        this.remotes?.update(dt);
        this.send(dt);
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
            title: this.finishTime !== null ? 'Chequered flag!' : 'Out of fuel!',
            stats: [
                { label: 'Race time', value: this.finishTime !== null ? `${this.finishTime.toFixed(2)}s` : `${this.lapsDone} / ${LAPS} laps` },
                { label: 'Best lap', value: this.bestLap !== null ? `${this.bestLap.toFixed(2)}s` : 'None' },
            ],
        };
    }

    resize(width: number, height: number): void {
        this.rig.resize(width, height);

        if (width < height) {
            this.rig.setFraming(12, 8);
        } else {
            this.rig.setFraming(9.5, 6);
        }
    }

    dispose(): void {
        this.remotes?.dispose();
    }

    /** Past the grass there is a soft wall that pushes you back towards the track. */
    private keepInBounds(distance: number): void {
        const limit = HALF_WIDTH + 4;

        if (distance <= limit) {
            return;
        }

        const point = this.track[this.trackIndex];
        const dx = this.kart.x - point.x;
        const dz = this.kart.z - point.z;
        this.kart.x = point.x + (dx / distance) * limit;
        this.kart.z = point.z + (dz / distance) * limit;
        this.kart.speed *= 0.6;
        this.bump();
    }

    private bumpKarts(dt: number): void {
        this.bumpCooldown -= dt;

        for (const player of this.context.network?.remotePlayers ?? []) {
            const other = this.remotes?.positionOf(player.id);
            if (!other) {
                continue;
            }

            const dx = this.kart.x - other.x;
            const dz = this.kart.z - other.z;
            const distance = Math.hypot(dx, dz);
            const minimum = KART_RADIUS * 2;

            if (distance < minimum && distance > 0.01) {
                this.kart.x = other.x + (dx / distance) * minimum;
                this.kart.z = other.z + (dz / distance) * minimum;
                this.kart.speed *= 0.85;
                this.bump();
            }
        }
    }

    private bump(): void {
        if (this.bumpCooldown > 0) {
            return;
        }

        this.bumpCooldown = 0.3;
        this.rig.shake(0.3);
        audio.play('bump');
    }

    /** A lap counts when you cross the line after visiting all three checkpoints. */
    private trackLaps(previous: number, current: number): void {
        for (const fraction of [0.25, 0.5, 0.75]) {
            const checkpoint = Math.floor(fraction * SAMPLES);
            if (Math.abs(current - checkpoint) < 12) {
                this.checkpoints.add(checkpoint);
            }
        }

        const crossedLine = previous > SAMPLES * 0.9 && current < SAMPLES * 0.1;

        if (!crossedLine || this.checkpoints.size < 3) {
            return;
        }

        this.checkpoints.clear();
        this.lapsDone++;
        const lapTime = this.time - this.lapStartedAt;
        this.lapStartedAt = this.time;
        this.bestLap = this.bestLap === null ? lapTime : Math.min(this.bestLap, lapTime);

        if (this.lapsDone >= LAPS) {
            this.finishTime = this.time;
            this.context.hud.setScore(this.getScore());
            this.context.hud.callout(`Finished! ${this.time.toFixed(1)}s`, 'good');
            this.effects.confetti(new THREE.Vector3(this.kart.x, 3, this.kart.z), 80);
            audio.play('win');
            return;
        }

        this.context.hud.callout('Final lap!', 'neutral');
        audio.play('bonus');
    }

    private checkBoosts(dt: number): void {
        this.boostCooldown -= dt;

        if (this.boostCooldown > 0) {
            return;
        }

        for (const pad of this.boosts) {
            const point = this.track[pad.index];
            const padX = point.x + point.dz * pad.offset;
            const padZ = point.z - point.dx * pad.offset;

            if (Math.hypot(this.kart.x - padX, this.kart.z - padZ) < 1.4) {
                this.kart.boost = 1.1;
                this.boostCooldown = 0.5;
                this.effects.dash(new THREE.Vector3(this.kart.x, 0.4, this.kart.z), palette.sun);
                audio.play('dash');
                return;
            }
        }
    }

    private syncDriver(dt: number): void {
        const root = this.driver.root;
        root.position.set(this.kart.x, SEAT_HEIGHT, this.kart.z);
        root.rotation.y = this.kart.heading;
        this.driver.update(dt, { speed: 0, grounded: true, verticalVelocity: 0 });

        this.kartMesh.traverse((child) => {
            if (child.name === 'wheel') {
                child.rotation.x += (this.kart.speed * dt) / 0.3;
            }
        });
        this.kartMesh.rotation.z = Math.sin(this.time * 30) * 0.01 * Math.min(1, Math.abs(this.kart.speed) / 10);
    }

    /** Karts don't use the character controller, so snapshots are built here. */
    private send(dt: number): void {
        const network = this.context.network;
        this.sendTimer -= dt;

        if (!network || this.sendTimer > 0) {
            return;
        }

        this.sendTimer = SEND_INTERVAL;
        network.send({
            t: Math.round(network.serverNow()),
            x: Math.round(this.kart.x * 100) / 100,
            y: SEAT_HEIGHT,
            z: Math.round(this.kart.z * 100) / 100,
            f: Math.round(this.kart.heading * 100) / 100,
            s: 0,
            g: 1,
            v: 0,
            o: 0,
            c: this.getScore(),
        });
    }

    private updateCamera(dt: number, snap: boolean): void {
        const target = new THREE.Vector3(this.kart.x, 0, this.kart.z);
        this.lighting.follow(target);
        this.rig.turnTowards(this.kart.heading + Math.PI, snap ? 1 : dt, snap ? 1000 : 5);

        if (snap) {
            this.rig.snap(target);
            return;
        }

        this.rig.setTarget(target);
        this.rig.update(dt);
    }

    private buildCircuit(): void {
        const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), toonMaterial(palette.grass));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -0.02, -10);
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Track ribbon.
        const positions: number[] = [];
        const indices: number[] = [];
        this.track.forEach((point) => {
            const nx = point.dz;
            const nz = -point.dx;
            positions.push(point.x + nx * HALF_WIDTH, 0.01, point.z + nz * HALF_WIDTH, point.x - nx * HALF_WIDTH, 0.01, point.z - nz * HALF_WIDTH);
        });
        for (let index = 0; index < SAMPLES; index++) {
            const next = (index + 1) % SAMPLES;
            indices.push(index * 2, next * 2, index * 2 + 1, index * 2 + 1, next * 2, next * 2 + 1);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        const road = new THREE.Mesh(geometry, createToonMaterial(0x5d5873, { side: THREE.DoubleSide }));
        road.receiveShadow = true;
        this.scene.add(road);

        // Red and white kerbs along both edges.
        const kerbGeometry = new THREE.BoxGeometry(0.5, 0.12, 0.9);
        this.track.forEach((point, index) => {
            if (index % 4 !== 0) {
                return;
            }

            for (const side of [-1, 1]) {
                const kerb = new THREE.Mesh(kerbGeometry, toonMaterial(Math.floor(index / 4) % 2 === 0 ? palette.coral : palette.white));
                kerb.position.set(point.x + point.dz * side * (HALF_WIDTH + 0.25), 0.06, point.z - point.dx * side * (HALF_WIDTH + 0.25));
                kerb.rotation.y = Math.atan2(point.dx, point.dz);
                this.scene.add(kerb);
            }
        });

        this.buildStartLine();

        for (const pad of this.boosts) {
            const point = this.track[pad.index];
            const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 3), toonMaterial(palette.sun));
            arrow.rotation.x = Math.PI / 2;
            arrow.scale.set(1, 1, 0.08);
            arrow.position.set(point.x + point.dz * pad.offset, 0.06, point.z - point.dx * pad.offset);
            const holder = new THREE.Group();
            holder.add(arrow);
            holder.position.copy(arrow.position);
            arrow.position.set(0, 0, 0);
            holder.rotation.y = Math.atan2(point.dx, point.dz);
            this.scene.add(holder);
        }

        for (let index = 0; index < 40; index++) {
            const point = this.track[(index * 37) % SAMPLES];
            const side = index % 2 === 0 ? 1 : -1;
            const distance = HALF_WIDTH + 6 + (index % 5) * 2;
            const tree = createTree(2.6 + (index % 3) * 0.6);
            tree.position.set(point.x + point.dz * side * distance, 0, point.z - point.dx * side * distance);
            const near = this.track.some((sample) => Math.hypot(sample.x - tree.position.x, sample.z - tree.position.z) < HALF_WIDTH + 5);
            if (!near) {
                this.scene.add(tree);
            }
        }
    }

    private buildStartLine(): void {
        const start = this.track[0];
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 16;
        const context = canvas.getContext('2d');
        if (context) {
            for (let x = 0; x < 16; x++) {
                for (let y = 0; y < 2; y++) {
                    context.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#2b2340';
                    context.fillRect(x * 8, y * 8, 8, 8);
                }
            }
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 1.2), createToonMaterial(0xffffff, { map: texture }));
        line.rotation.x = -Math.PI / 2;
        line.position.set(start.x, 0.03, start.z);
        line.rotation.z = -Math.atan2(start.dx, start.dz);
        this.scene.add(line);

        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.5, 10), toonMaterial(palette.coral));
            post.position.set(start.x + start.dz * side * (HALF_WIDTH + 0.6), 2.25, start.z - start.dx * side * (HALF_WIDTH + 0.6));
            addOutline(post);
            this.scene.add(post);
        }

        const banner = new THREE.Mesh(new RoundedBoxGeometry(HALF_WIDTH * 2 + 1.5, 0.9, 0.25, 2, 0.1), createToonMaterial(0xffffff, { map: texture }));
        banner.position.set(start.x, 4.5, start.z);
        banner.rotation.y = Math.atan2(start.dx, start.dz) + Math.PI / 2;
        addOutline(banner);
        this.scene.add(banner);
    }
}

export const createKartRace: MinigameFactory = (context) => new KartRace(context);
