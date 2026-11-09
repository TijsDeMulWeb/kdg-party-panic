import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '../../audio/AudioManager';
import { CameraRig } from '../../core/CameraRig';
import type { InputSnapshot } from '../../core/InputManager';
import { CharacterController } from '../../characters/CharacterController';
import { CharacterModel } from '../../characters/CharacterModel';
import { createNameTag } from '../../characters/NameTag';
import { createCloudLayer, createLighting, createSky, type CloudLayer, type Lighting } from '../../design/environment';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette, partyColors } from '../../design/palette';
import { SYMBOL_COLORS, symbolGeometry } from '../../design/symbols';
import { Effects } from '../../effects/Effects';
import { RemoteCharacters } from '../../multiplayer/RemoteCharacters';
import { SnapshotSender } from '../../multiplayer/SnapshotSender';
import { StaticWorld } from '../../world/StaticWorld';
import { WorldWithMovingObstacles } from '../../world/WorldWithMovingObstacles';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { BELT_HALF_WIDTH, Station } from './Station';
import { BELT_LENGTH, BIN_SHUFFLE_TIMES, beltSpeed, binsAt, deliveryPoints, LANE_COUNT, laneAt, laneCenter, planBins, planPackages, type BinLayout, type PackagePlan } from './rules';

const PACKAGE_HALF = 0.55;
const STATION_SPACING = 10;
/** How close (centre to centre) a package must be to shove it. */
const SHOVE_REACH = 1.9;
const SHOVE_SPEED = 14;
const NEUTRAL: InputSnapshot = { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, actionPressed: false, actionHeld: false, lookX: 0, lookY: 0 };

interface LivePackage {
    plan: PackagePlan;
    mesh: THREE.Group;
    x: number;
    z: number;
    state: 'riding' | 'falling';
    fallTime: number;
    wobble: number;
    /** Lane centre the package slides to after a shove. */
    targetX: number | null;
}

const packageGeometry = new RoundedBoxGeometry(PACKAGE_HALF * 2, PACKAGE_HALF * 1.6, PACKAGE_HALF * 2, 2, 0.08);
const tapeGeometry = new THREE.BoxGeometry(PACKAGE_HALF * 2.02, 0.05, 0.22);

/** Station x for a seat, centred around 0 for the whole party. */
export function stationX(seat: number, seats: number): number {
    return (seat - (seats - 1) / 2) * STATION_SPACING;
}

/**
 * Package Panic: shove parcels across the conveyor into the bin of
 * matching colour before they drop off the end.
 */
class PackagePanic implements Minigame {
    readonly scene = new THREE.Scene();
    private readonly rig = new CameraRig({ distance: 8, height: 9.5, lookHeight: 0, rotateSpeed: 0, followSharpness: 4 });
    readonly camera = this.rig.camera;

    private readonly world = new StaticWorld();
    private readonly station: Station;
    private readonly otherStations: Station[] = [];
    private readonly player: CharacterController;
    private readonly effects: Effects;
    private readonly lighting: Lighting;
    private readonly clouds: CloudLayer;
    private readonly plans: PackagePlan[];
    private readonly bins: BinLayout[];
    private readonly packages: LivePackage[] = [];
    private readonly remotes: RemoteCharacters | null = null;
    private readonly snapshots: SnapshotSender | null = null;
    private readonly originX: number;
    private readonly cameraTarget = new THREE.Vector3();
    private nextPackage = 0;
    private binIndex = 0;
    private time = 0;
    private visualTime = 0;
    private score = 0;
    private combo = 0;
    private bestCombo = 0;
    private delivered = 0;
    private missed = 0;
    private finished = false;

    constructor(private readonly context: MinigameContext) {
        this.plans = planPackages(context.seed);
        this.bins = planBins(context.seed);

        this.scene.add(createSky());
        this.lighting = createLighting(this.scene, 12);
        this.clouds = createCloudLayer(16, 30, 80, -10, 14);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);
        this.buildFactory();

        const network = context.network;
        const seats = network ? network.remotePlayers.length + 1 : 1;
        const allSeats = network ? [network.localSeat, ...network.remotePlayers.map((player) => player.seat)].sort((a, b) => a - b) : [0];
        const localIndex = allSeats.indexOf(network?.localSeat ?? 0);
        this.originX = stationX(localIndex, seats);

        this.station = new Station(this.originX, partyColors[localIndex % partyColors.length], this.world);
        this.station.setBinColors(this.bins[0].lanes);
        this.scene.add(this.station.group);

        allSeats.forEach((_, index) => {
            if (index !== localIndex) {
                const other = new Station(stationX(index, seats), partyColors[index % partyColors.length]);
                other.setBinColors(this.bins[0].lanes);
                this.otherStations.push(other);
                this.scene.add(other.group);
            }
        });

        const model = new CharacterModel(context.character, context.hat);
        this.scene.add(model.root);

        if (network) {
            this.remotes = new RemoteCharacters(this.scene, network, (position) => this.effects.poof(position));
            this.snapshots = new SnapshotSender(network);
            model.root.add(createNameTag('You', context.character.body, true, 1.4));
        }

        const world = this.remotes ? new WorldWithMovingObstacles(this.world, () => this.remotes?.obstacles() ?? []) : this.world;
        const spawn = new THREE.Vector3(this.originX, 0, -2);
        this.player = new CharacterController(model, world, spawn);
        this.player.teleport(spawn, Math.PI);
        this.updateCamera(0, true);
    }

    start(): void {
        this.time = 0;
    }

    getScore(): number {
        return this.score;
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        this.visualTime += dt;
        const playing = elapsed !== null;
        const speed = beltSpeed(this.time);

        if (playing) {
            this.time = elapsed;
            this.spawnPackages();
            this.shuffleBins();
        }

        // The action button shoves packages here instead of dashing.
        const controls = playing ? { ...input, actionPressed: false } : NEUTRAL;
        const events = this.player.update(dt, controls, this.rig.getYaw());

        if (playing && input.actionPressed) {
            this.shove();
        }
        if (events.landed) {
            this.effects.landing(this.player.position, events.landingSpeed);
        }
        if (events.dashed) {
            this.effects.dash(this.player.position.clone().setY(0.4), this.context.character.body);
        }

        this.updatePackages(playing ? dt : 0, speed);
        this.pushPackages();

        this.station.update(playing ? dt : 0, speed);
        this.station.animate(dt);
        for (const other of this.otherStations) {
            other.update(playing ? dt : 0, speed);
            other.animate(dt);
        }

        this.remotes?.update(dt);
        this.snapshots?.update(dt, this.player, false, this.score);
        this.updateCamera(dt, false);
        this.clouds.update(dt);
        this.effects.update(dt);

        if (playing && this.nextPackage >= this.plans.length && this.packages.length === 0) {
            this.finished = true;
        }
    }

    isOver(): boolean {
        return this.finished;
    }

    getResult(): MinigameResult {
        const total = this.delivered + this.missed;

        return {
            score: this.score,
            title: this.delivered >= this.plans.length * 0.8 ? 'Sorting superstar!' : 'Shift over!',
            stats: [
                { label: 'Packages delivered', value: `${this.delivered} / ${this.plans.length}` },
                { label: 'Best combo', value: `x${this.bestCombo}` },
                { label: 'Accuracy', value: total === 0 ? 'None' : `${Math.round((this.delivered / total) * 100)}%` },
            ],
        };
    }

    resize(width: number, height: number): void {
        this.rig.resize(width, height);

        if (width < height) {
            this.rig.setFraming(12, 14);
        } else {
            this.rig.setFraming(8, 9.5);
        }
    }

    dispose(): void {
        this.remotes?.dispose();
        this.station.dispose();
        this.otherStations.forEach((station) => station.dispose());
    }

    private spawnPackages(): void {
        while (this.nextPackage < this.plans.length && this.plans[this.nextPackage].spawnAt <= this.time) {
            const plan = this.plans[this.nextPackage++];
            const mesh = this.createPackage(plan.color);
            const x = this.originX + laneCenter(plan.lane);
            mesh.position.set(x, PACKAGE_HALF * 0.8, -BELT_LENGTH + PACKAGE_HALF);
            this.scene.add(mesh);
            this.packages.push({ plan, mesh, x, z: -BELT_LENGTH + PACKAGE_HALF, state: 'riding', fallTime: 0, wobble: 1, targetX: null });
            audio.play('pop', 0.4);
        }
    }

    private shuffleBins(): void {
        const next = BIN_SHUFFLE_TIMES.findIndex((time, index) => index > this.binIndex && this.time >= time);

        if (next === -1) {
            return;
        }

        this.binIndex = next;
        const lanes = binsAt(this.bins, this.time);
        this.station.setBinColors(lanes);
        this.otherStations.forEach((station) => station.setBinColors(lanes));
        this.context.hud.callout('Bins shuffled!', 'neutral');
        audio.play('bonus', 0.7);
    }

    private updatePackages(dt: number, speed: number): void {
        for (let index = this.packages.length - 1; index >= 0; index--) {
            const item = this.packages[index];
            item.wobble = Math.max(0, item.wobble - dt * 3);

            if (item.state === 'riding') {
                item.z += speed * dt;

                if (item.targetX !== null) {
                    const step = SHOVE_SPEED * dt;
                    const remaining = item.targetX - item.x;
                    item.x = Math.abs(remaining) <= step ? item.targetX : item.x + Math.sign(remaining) * step;
                    if (item.x === item.targetX) {
                        item.targetX = null;
                    }
                }

                if (item.z - PACKAGE_HALF > 0) {
                    item.state = 'falling';
                    this.deliver(item);
                }
            }

            if (item.state === 'falling') {
                item.fallTime += dt;
                item.z += speed * dt * 0.6;
                item.mesh.rotation.x += dt * 4;

                if (item.fallTime > 0.6) {
                    this.scene.remove(item.mesh);
                    this.packages.splice(index, 1);
                    continue;
                }
            }

            const fallY = item.state === 'falling' ? -9 * item.fallTime * item.fallTime : 0;
            item.mesh.position.set(item.x, PACKAGE_HALF * 0.8 + fallY, item.z);
            item.mesh.scale.setScalar(1 + Math.sin(item.wobble * Math.PI) * 0.12);
        }
    }

    /**
     * Walking into a parcel from the side shoves it across the belt; walking
     * in front of it gets you carried along. Parcels stop at the side rails.
     */
    private pushPackages(): void {
        const position = this.player.state.position;
        const radius = this.player.config.radius;

        for (const item of this.packages) {
            if (item.state !== 'riding' || position.y > PACKAGE_HALF * 1.6) {
                continue;
            }

            const closestX = Math.min(Math.max(position.x, item.x - PACKAGE_HALF), item.x + PACKAGE_HALF);
            const closestZ = Math.min(Math.max(position.z, item.z - PACKAGE_HALF), item.z + PACKAGE_HALF);
            const dx = position.x - closestX;
            const dz = position.z - closestZ;
            const distance = Math.hypot(dx, dz);

            if (distance >= radius) {
                continue;
            }

            const sideContact = Math.abs(dx) >= Math.abs(dz);

            if (sideContact) {
                const direction = position.x < item.x ? 1 : -1;
                const wanted = position.x + direction * (radius + PACKAGE_HALF);
                const limit = this.originX + direction * (BELT_HALF_WIDTH - PACKAGE_HALF);
                item.x = direction > 0 ? Math.min(wanted, limit) : Math.max(wanted, limit);
                item.targetX = null;
                item.wobble = Math.max(item.wobble, 0.5);

                if (item.x === limit) {
                    position.x = item.x - direction * (radius + PACKAGE_HALF);
                }
                continue;
            }

            const direction = position.z < item.z ? -1 : 1;
            position.z = item.z + direction * (PACKAGE_HALF + radius);
        }
    }

    /**
     * Kicks the nearest package one lane over: in the direction you face,
     * or away from you when you stand straight in front of it. This is how
     * a package stuck against a side rail gets back out.
     */
    private shove(): void {
        const { position, facing } = this.player.state;
        let nearest: LivePackage | null = null;
        let nearestDistance = SHOVE_REACH;

        for (const item of this.packages) {
            const distance = Math.hypot(item.x - position.x, item.z - position.z);
            if (item.state === 'riding' && distance < nearestDistance) {
                nearest = item;
                nearestDistance = distance;
            }
        }

        this.player.model.jump();
        audio.play('dash', 0.6);

        if (!nearest) {
            return;
        }

        const facingX = Math.sin(facing);
        const awayFromPlayer = nearest.x >= position.x ? 1 : -1;
        const direction = Math.abs(facingX) > 0.35 ? Math.sign(facingX) : awayFromPlayer;
        const lane = Math.min(LANE_COUNT - 1, Math.max(0, laneAt((nearest.targetX ?? nearest.x) - this.originX) + direction));
        const targetX = this.originX + laneCenter(lane);

        if (Math.abs(targetX - nearest.x) < 0.05) {
            audio.play('bump', 0.6);
            return;
        }

        nearest.targetX = targetX;
        nearest.wobble = 1;
        this.effects.dash(new THREE.Vector3(nearest.x, 0.6, nearest.z), this.context.character.body);
    }

    private deliver(item: LivePackage): void {
        const lane = laneAt(item.x - this.originX);
        const binColor = binsAt(this.bins, this.time)[lane];
        const bin = this.station.binPosition(lane);

        if (binColor === item.plan.color) {
            const points = deliveryPoints(this.combo);
            this.score += points;
            this.combo++;
            this.bestCombo = Math.max(this.bestCombo, this.combo);
            this.delivered++;
            this.effects.confetti(bin.clone().setY(0), 25);
            this.context.hud.setScore(this.score);
            this.context.hud.callout(this.combo >= 3 ? `x${this.combo} +${points}` : `+${points}`, 'good');
            audio.play(this.combo >= 3 ? 'bonus' : 'score');
            return;
        }

        this.combo = 0;
        this.missed++;
        this.effects.poof(bin.clone().setY(-0.5));
        this.context.hud.callout('Wrong bin!', 'bad');
        audio.play('wrong');
    }

    private createPackage(colorIndex: number): THREE.Group {
        const color = SYMBOL_COLORS[colorIndex];
        const group = new THREE.Group();
        const box = new THREE.Mesh(packageGeometry, toonMaterial(color.color));
        box.castShadow = true;
        addOutline(box);
        const tape = new THREE.Mesh(tapeGeometry, toonMaterial(0xf3e3c0));
        tape.position.y = PACKAGE_HALF * 0.8;
        const symbol = new THREE.Mesh(symbolGeometry(color.symbol, 0.36), toonMaterial(palette.white));
        symbol.position.y = PACKAGE_HALF * 0.8 + 0.03;
        group.add(box, tape, symbol);

        return group;
    }

    private buildFactory(): void {
        const floor = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 1, 48), toonMaterial(0xb9c4e6));
        floor.position.y = -3.5;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const gearMaterial = toonMaterial(palette.tangerine);
        const gears: [number, number, number, number][] = [
            [-14, 6, -22, 4],
            [12, 9, -24, 5],
            [0, 12, -30, 3],
        ];

        for (const [x, y, z, size] of gears) {
            const gear = new THREE.Mesh(new THREE.TorusGeometry(size, size * 0.25, 8, 12), gearMaterial);
            gear.position.set(x, y, z);
            gear.userData.spin = size % 2 === 0 ? 0.3 : -0.4;
            addOutline(gear);
            this.scene.add(gear);
            gear.onBeforeRender = () => {
                gear.rotation.z = this.visualTime * (gear.userData.spin as number);
            };
        }
    }

    private updateCamera(dt: number, snap: boolean): void {
        this.cameraTarget.set(this.originX + (this.player.position.x - this.originX) * 0.3, 0, -3.2);
        this.lighting.follow(this.cameraTarget);

        if (snap) {
            this.rig.snap(this.cameraTarget);
            return;
        }

        this.rig.setTarget(this.cameraTarget);
        this.rig.update(dt);
    }
}

export const createPackagePanic: MinigameFactory = (context) => new PackagePanic(context);
