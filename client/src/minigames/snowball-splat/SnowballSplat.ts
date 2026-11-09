import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { addOutline, createToonMaterial, toonMaterial } from '../../design/materials';
import { palette } from '../../design/palette';
import { ClaimBook } from '../../multiplayer/ClaimBook';
import { packSections, unpackSections } from '../../multiplayer/extraSections';
import { el } from '../../ui/dom';
import { StaticWorld } from '../../world/StaticWorld';
import { createTree } from '../../world/props';
import { MinigameStage } from '../shared/MinigameStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import {
    FREEZE_TIME,
    GRAVITY,
    HALF_SIZE,
    MAX_AMMO,
    planSnowmen,
    planWalls,
    PLAYER_HIT_POINTS,
    RELOAD_TIME,
    SNOWMAN_LIFETIME,
    SNOWMAN_POINTS,
    THROW_SPEED,
    type SnowmanPlan,
    type WallPlan,
} from './rules';

/** Snapshot sections: throws, hits we took, snowman claims. */
const THROWS = 1;
const HITS = 2;
const CLAIMS = 3;
const REPEAT_MS = 1000;
const AIM_ASSIST_ANGLE = Math.PI / 6;

interface Snowball {
    key: string;
    ownerId: number;
    throwId: number;
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
}

interface SentThrow {
    id: number;
    x: number;
    z: number;
    dx: number;
    dz: number;
    time: number;
}

const ballGeometry = new THREE.SphereGeometry(0.2, 12, 8);

/**
 * Snowball Splat: throw snowballs at snowmen and at each other.
 * Hits are decided by the player who gets hit (on their own client), who
 * then credits the thrower; nobody decides about someone else.
 */
class SnowballSplat implements Minigame {
    private readonly world = new StaticWorld();
    private readonly stage: MinigameStage;
    private readonly walls: WallPlan[];
    private readonly snowmanPlans: SnowmanPlan[];
    private readonly snowmen = new Map<number, THREE.Group>();
    private readonly snowballs: Snowball[] = [];
    private readonly seenThrows = new Set<string>();
    private readonly sentThrows: SentThrow[] = [];
    private readonly hitsTaken: { thrower: number; throwId: number; time: number }[] = [];
    private readonly creditedHits = new Set<string>();
    private readonly claims: ClaimBook;
    private readonly iceBlock: THREE.Mesh;
    private readonly ammoBar: HTMLElement;
    private readonly unsubscribe: (() => void) | null = null;
    private readonly myId: number;
    private nextSnowman = 0;
    private nextThrowId = 1;
    private time = 0;
    private score = 0;
    private ammo = MAX_AMMO;
    private reload = 0;
    private frozen = 0;
    private snowmenHit = 0;
    private playersHit = 0;
    private timesHit = 0;

    constructor(private readonly context: MinigameContext) {
        this.walls = planWalls(context.seed);
        this.snowmanPlans = planSnowmen(context.seed, this.walls);
        this.myId = context.network?.localPlayerId ?? 0;

        const corners = [
            [-6.5, 6.5],
            [6.5, -6.5],
            [6.5, 6.5],
            [-6.5, -6.5],
        ];
        this.stage = new MinigameStage(context, {
            world: this.world,
            spawn: (seat) => new THREE.Vector3(context.network ? corners[seat % 4][0] : 0, 0, context.network ? corners[seat % 4][1] : 5),
            framing: { distance: 10, height: 15, portraitDistance: 16, portraitHeight: 24 },
        });
        this.buildArena();

        this.iceBlock = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 1.3), createToonMaterial(0xbfe9ff, { transparent: true, opacity: 0.55 }));
        this.iceBlock.position.y = 0.8;
        this.iceBlock.visible = false;
        this.stage.player.model.root.add(this.iceBlock);

        this.claims = new ClaimBook(context.network, () => this.time, (id) => this.popSnowman(id, false), false);
        this.ammoBar = el('div', { className: 'ammo-bar' });
        context.overlay.append(this.ammoBar);
        this.renderAmmo();

        if (context.network) {
            this.unsubscribe = context.network.onSnapshot((playerId, snapshot) => this.receive(playerId, snapshot.e));
        }

        this.stage.follow(new THREE.Vector3(0, 0, 1), 0, true);
    }

    get scene(): THREE.Scene {
        return this.stage.scene;
    }

    get camera(): THREE.Camera {
        return this.stage.camera;
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
        }

        this.frozen = Math.max(0, this.frozen - dt);
        this.iceBlock.visible = this.frozen > 0;
        this.stage.movePlayer(dt, input, playing && this.frozen === 0, false);

        if (playing) {
            this.reloadAmmo(dt);
            if (input.actionPressed && this.frozen === 0) {
                this.throwSnowball();
            }
            this.spawnSnowmen();
        }

        this.updateSnowballs(dt);
        this.animateSnowmen(dt);
        this.stage.updateShared(dt, this.score, false, () => this.payload());
        const feet = this.stage.position;
        this.stage.follow(new THREE.Vector3(feet.x * 0.3, 0, feet.z * 0.3 + 1), dt);
    }

    isOver(): boolean {
        return false;
    }

    getResult(): MinigameResult {
        const stats = [{ label: 'Snowmen splatted', value: String(this.snowmenHit) }];

        if (this.context.network) {
            stats.push({ label: 'Players hit', value: String(this.playersHit) }, { label: 'Times you got hit', value: String(this.timesHit) });
        }

        return { score: this.score, title: this.timesHit === 0 ? 'Snow ninja!' : 'Brrr-illiant!', stats };
    }

    resize(width: number, height: number): void {
        this.stage.resize(width, height);
    }

    dispose(): void {
        this.unsubscribe?.();
        this.claims.dispose();
        this.ammoBar.remove();
        this.stage.dispose();
    }

    private now(): number {
        return this.context.network ? this.context.network.serverNow() : this.time * 1000;
    }

    private reloadAmmo(dt: number): void {
        if (this.ammo >= MAX_AMMO) {
            this.reload = 0;
            return;
        }

        this.reload += dt;
        if (this.reload >= RELOAD_TIME) {
            this.reload = 0;
            this.ammo++;
            this.renderAmmo();
        }
    }

    private renderAmmo(): void {
        this.ammoBar.replaceChildren(
            el('span', { className: 'ammo-bar__label', text: 'Snowballs' }),
            ...Array.from({ length: MAX_AMMO }, (_, index) => el('span', { className: `ammo-bar__ball ${index < this.ammo ? 'is-full' : ''}` })),
        );
    }

    /** Throws in the facing direction, nudged towards the nearest target in a narrow cone. */
    private throwSnowball(): void {
        if (this.ammo === 0) {
            audio.play('click');
            return;
        }

        const { position, facing } = this.stage.player.state;
        let dirX = Math.sin(facing);
        let dirZ = Math.cos(facing);
        const target = this.aimTarget(position.x, position.z, dirX, dirZ);

        if (target) {
            const length = Math.hypot(target.x - position.x, target.z - position.z);
            dirX = (target.x - position.x) / length;
            dirZ = (target.z - position.z) / length;
        }

        this.ammo--;
        this.renderAmmo();
        const throwId = this.nextThrowId++;
        const sent = { id: throwId, x: position.x + dirX * 0.7, z: position.z + dirZ * 0.7, dx: dirX, dz: dirZ, time: this.now() };
        this.sentThrows.push(sent);
        this.spawnSnowball(this.myId, throwId, sent.x, sent.z, dirX, dirZ, 0);
        this.stage.player.model.jump();
        audio.play('dash', 0.5);
    }

    private aimTarget(x: number, z: number, dirX: number, dirZ: number): { x: number; z: number } | null {
        const candidates: { x: number; z: number }[] = [...this.snowmen.values()].map((snowman) => ({ x: snowman.position.x, z: snowman.position.z }));

        for (const player of this.context.network?.remotePlayers ?? []) {
            const position = this.stage.remotes?.positionOf(player.id);
            if (position) {
                candidates.push({ x: position.x, z: position.z });
            }
        }

        let best: { x: number; z: number } | null = null;
        let bestDistance = 16;

        for (const candidate of candidates) {
            const dx = candidate.x - x;
            const dz = candidate.z - z;
            const distance = Math.hypot(dx, dz);
            const angle = Math.acos(Math.min(1, (dx * dirX + dz * dirZ) / (distance || 1)));

            if (angle < AIM_ASSIST_ANGLE && distance < bestDistance) {
                best = candidate;
                bestDistance = distance;
            }
        }

        return best;
    }

    private spawnSnowball(ownerId: number, throwId: number, x: number, z: number, dirX: number, dirZ: number, age: number): void {
        const key = `${ownerId}:${throwId}`;

        if (this.seenThrows.has(key)) {
            return;
        }

        this.seenThrows.add(key);
        const mesh = new THREE.Mesh(ballGeometry, toonMaterial(palette.white));
        addOutline(mesh).scale.setScalar(1.15);
        mesh.castShadow = true;
        this.stage.scene.add(mesh);

        const snowball: Snowball = {
            key,
            ownerId,
            throwId,
            mesh,
            position: new THREE.Vector3(x, 1.2, z),
            velocity: new THREE.Vector3(dirX * THROW_SPEED, 3.2, dirZ * THROW_SPEED),
        };

        // Catch up on flight time for throws that arrived late over the network.
        for (let elapsed = 0; elapsed < age; elapsed += 1 / 60) {
            this.stepSnowball(snowball, 1 / 60);
        }

        this.snowballs.push(snowball);
    }

    private stepSnowball(snowball: Snowball, dt: number): void {
        snowball.velocity.y -= GRAVITY * dt;
        snowball.position.addScaledVector(snowball.velocity, dt);
    }

    private updateSnowballs(dt: number): void {
        const feet = this.stage.player.state.position;

        for (let index = this.snowballs.length - 1; index >= 0; index--) {
            const snowball = this.snowballs[index];
            this.stepSnowball(snowball, dt);
            snowball.mesh.position.copy(snowball.position);
            const { x, y, z } = snowball.position;
            let splat = y < 0 || Math.abs(x) > HALF_SIZE + 1 || Math.abs(z) > HALF_SIZE + 1;

            splat ||= this.walls.some((wall) => y < 1.3 && Math.abs(x - wall.x) < wall.width / 2 + 0.2 && Math.abs(z - wall.z) < wall.depth / 2 + 0.2);

            if (!splat && snowball.ownerId === this.myId) {
                splat = this.hitSnowman(snowball);
            }

            // We only ever judge hits on ourselves.
            if (!splat && snowball.ownerId !== this.myId && Math.hypot(x - feet.x, z - feet.z) < 0.6 && y - feet.y < 1.6) {
                splat = true;
                this.takeHit(snowball);
            }

            if (!splat && snowball.ownerId === this.myId) {
                for (const player of this.context.network?.remotePlayers ?? []) {
                    const position = this.stage.remotes?.positionOf(player.id);
                    if (position && Math.hypot(x - position.x, z - position.z) < 0.6 && y - position.y < 1.6) {
                        splat = true;
                    }
                }
            }

            if (splat) {
                this.stage.effects.landing(snowball.position.clone().setY(Math.max(0.1, y)), 8);
                this.stage.scene.remove(snowball.mesh);
                this.snowballs.splice(index, 1);
            }
        }
    }

    private hitSnowman(snowball: Snowball): boolean {
        for (const [id, snowman] of this.snowmen) {
            if (Math.hypot(snowball.position.x - snowman.position.x, snowball.position.z - snowman.position.z) < 0.7 && snowball.position.y < 2) {
                if (this.claims.claim(id)) {
                    this.score += SNOWMAN_POINTS;
                    this.snowmenHit++;
                    this.context.hud.setScore(this.score);
                    this.context.hud.callout(`+${SNOWMAN_POINTS}`, 'good');
                    audio.play('score');
                }
                this.popSnowman(id, true);
                return true;
            }
        }

        return false;
    }

    private takeHit(snowball: Snowball): void {
        if (this.frozen > 0) {
            return;
        }

        this.frozen = FREEZE_TIME;
        this.timesHit++;
        this.hitsTaken.push({ thrower: snowball.ownerId, throwId: snowball.throwId, time: this.now() });
        const push = snowball.velocity.clone().setY(0).normalize().multiplyScalar(5);
        this.stage.player.knockback(push.x, push.z, 3);
        this.stage.rig.shake(0.4);
        this.context.hud.callout('Brrr! Frozen!', 'bad');
        audio.play('bump', 1.3);
    }

    private spawnSnowmen(): void {
        while (this.nextSnowman < this.snowmanPlans.length && this.snowmanPlans[this.nextSnowman].spawnAt <= this.time) {
            const plan = this.snowmanPlans[this.nextSnowman++];

            if (this.claims.isClaimed(plan.id)) {
                continue;
            }

            const snowman = this.createSnowman();
            snowman.position.set(plan.x, 0, plan.z);
            snowman.userData.plan = plan;
            snowman.scale.setScalar(0.01);
            this.stage.scene.add(snowman);
            this.snowmen.set(plan.id, snowman);
        }

        for (const [id, snowman] of this.snowmen) {
            const plan = snowman.userData.plan as SnowmanPlan;
            if (this.time - plan.spawnAt > SNOWMAN_LIFETIME) {
                this.stage.scene.remove(snowman);
                this.snowmen.delete(id);
            }
        }
    }

    private popSnowman(id: number, hitByMe: boolean): void {
        const snowman = this.snowmen.get(id);

        if (!snowman) {
            return;
        }

        this.stage.effects.poof(snowman.position.clone().setY(1));
        if (hitByMe) {
            this.stage.effects.confetti(snowman.position.clone().setY(1.5), 20);
        }
        this.stage.scene.remove(snowman);
        this.snowmen.delete(id);
    }

    private animateSnowmen(dt: number): void {
        for (const snowman of this.snowmen.values()) {
            const plan = snowman.userData.plan as SnowmanPlan;
            const age = this.time - plan.spawnAt;
            const grow = Math.min(1, age * 4);
            const shrink = Math.min(1, (SNOWMAN_LIFETIME - age) * 3);
            snowman.scale.setScalar(Math.max(0.01, Math.min(grow, shrink)));
            snowman.rotation.y += dt * 0.5;
        }
    }

    private payload(): number[] {
        const now = this.now();
        const recentThrows = this.sentThrows.filter((sent) => now - sent.time < REPEAT_MS);
        const recentHits = this.hitsTaken.filter((hit) => now - hit.time < REPEAT_MS * 2);

        return packSections({
            [THROWS]: recentThrows.flatMap((sent) => [sent.id, Math.round(sent.x * 100), Math.round(sent.z * 100), Math.round(sent.dx * 100), Math.round(sent.dz * 100), Math.round(sent.time)]),
            [HITS]: recentHits.flatMap((hit) => [hit.thrower, hit.throwId]),
            [CLAIMS]: this.claims.payload(),
        });
    }

    private receive(playerId: number, packed: number[] | undefined): void {
        const sections = unpackSections(packed);
        const throws = sections.get(THROWS) ?? [];

        for (let index = 0; index + 5 < throws.length; index += 6) {
            const [throwId, x, z, dx, dz, time] = throws.slice(index, index + 6);
            const age = Math.max(0, Math.min(1, (this.now() - time) / 1000));
            this.spawnSnowball(playerId, throwId, x / 100, z / 100, dx / 100, dz / 100, age);
        }

        const hits = sections.get(HITS) ?? [];
        for (let index = 0; index + 1 < hits.length; index += 2) {
            const [thrower, throwId] = hits.slice(index, index + 2);
            const key = `${playerId}:${throwId}`;

            if (thrower === this.myId && !this.creditedHits.has(key)) {
                this.creditedHits.add(key);
                this.score += PLAYER_HIT_POINTS;
                this.playersHit++;
                this.context.hud.setScore(this.score);
                this.context.hud.callout(`Splat! +${PLAYER_HIT_POINTS}`, 'good');
                audio.play('bonus');
            }
        }

        this.claims.receiveFrom(playerId, sections.get(CLAIMS));
    }

    private createSnowman(): THREE.Group {
        const snowman = new THREE.Group();
        const snow = toonMaterial(palette.white);
        const sizes: [number, number][] = [
            [0.55, 0.5],
            [0.4, 1.25],
            [0.3, 1.85],
        ];

        for (const [radius, y] of sizes) {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), snow);
            ball.position.y = y;
            ball.castShadow = true;
            addOutline(ball).scale.setScalar(1.06);
            snowman.add(ball);
        }

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), toonMaterial(palette.tangerine));
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 1.85, 0.35);
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.35, 12), toonMaterial(palette.ink));
        hat.position.y = 2.25;
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), toonMaterial(palette.ink));
            eye.position.set(side * 0.1, 1.95, 0.27);
            snowman.add(eye);
        }
        snowman.add(nose, hat);

        return snowman;
    }

    private buildArena(): void {
        const scene = this.stage.scene;
        const size = HALF_SIZE * 2 + 2;
        const ground = new THREE.Mesh(new THREE.BoxGeometry(size + 4, 1, size + 4), toonMaterial(0xf4f8ff));
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);
        this.world.addBox({ x: 0, y: -0.5, z: 0 }, { x: size + 4, y: 1, z: size + 4 });

        const wallMaterial = toonMaterial(0xe3f1ff);
        for (const wall of this.walls) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.width, 1.2, wall.depth), wallMaterial);
            mesh.position.set(wall.x, 0.6, wall.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            addOutline(mesh);
            scene.add(mesh);
            this.world.addBox({ x: wall.x, y: 0.6, z: wall.z }, { x: wall.width, y: 1.2, z: wall.depth });
        }

        const edge = HALF_SIZE + 0.8;
        for (const [x, z, w, d] of [
            [0, -edge, size, 0.6],
            [0, edge, size, 0.6],
            [-edge, 0, 0.6, size],
            [edge, 0, 0.6, size],
        ]) {
            const bank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), toonMaterial(palette.white));
            bank.position.set(x, 0.35, z);
            scene.add(bank);
            this.world.addBox({ x, y: 1, z }, { x: w, y: 2.4, z: d }, { walkable: false });
        }

        for (let index = 0; index < 12; index++) {
            const angle = (index / 12) * Math.PI * 2;
            const tree = createTree(3.4);
            tree.position.set(Math.cos(angle) * (HALF_SIZE + 3.5), 0, Math.sin(angle) * (HALF_SIZE + 3.5));
            tree.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.IcosahedronGeometry) {
                    child.material = toonMaterial(0x2f8f5b);
                }
            });
            scene.add(tree);
        }
    }
}

export const createSnowballSplat: MinigameFactory = (context) => new SnowballSplat(context);
