import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette, partyColors } from '../../design/palette';
import { StaticWorld, type CylinderHandle } from '../../world/StaticWorld';
import { MinigameStage } from '../shared/MinigameStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { arenaRadius, DURATION, scoreFor, START_RADIUS, SWEEPER_FROM, sweeperAngle } from './rules';

const SHOVE_SPEED = 13;
const HIT_BROADCAST_MS = 600;
const SWEEPER_HEIGHT = 0.75;

interface Hit {
    target: number;
    dx: number;
    dz: number;
    time: number;
}

/**
 * Bumper Sumo: stay on the shrinking ring. Dash into others to knock them
 * off, jump over the spinning sweeper.
 *
 * Nobody controls someone else's character. A dash into another player
 * sends a "hit" in the snapshot; the victim's own client applies the
 * knockback. That costs a little latency, but keeps every client in charge
 * of its own position.
 */
class BumperSumo implements Minigame {
    private readonly world = new StaticWorld();
    private readonly stage: MinigameStage;
    private readonly arena: CylinderHandle;
    private readonly arenaMesh: THREE.Group;
    private readonly sweeper: THREE.Group;
    private readonly hitsSent: Hit[] = [];
    private readonly hitsReceived = new Set<string>();
    private readonly unsubscribe: (() => void) | null = null;
    private time = 0;
    private outAt: number | null = null;
    private knockouts = 0;
    private bumpCooldown = 0;

    constructor(private readonly context: MinigameContext) {
        const seats = [
            [0, 4],
            [-4, 0],
            [4, 0],
            [0, -4],
        ];
        this.stage = new MinigameStage(context, {
            world: this.world,
            spawn: (seat) => new THREE.Vector3(context.network ? seats[seat % 4][0] : 0, 0, context.network ? seats[seat % 4][1] : 4),
            framing: { distance: 11, height: 15, portraitDistance: 17, portraitHeight: 25 },
        });

        this.arena = this.world.addCylinder(0, -2, 0, START_RADIUS, 2);
        this.arenaMesh = this.createArena();
        this.sweeper = this.createSweeper();
        this.stage.scene.add(this.arenaMesh, this.sweeper);

        if (context.network) {
            this.unsubscribe = context.network.onSnapshot((playerId, snapshot) => this.receiveHits(playerId, snapshot.e));
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
        const survived = this.outAt ?? this.time;
        return scoreFor(survived, this.outAt === null && this.time >= DURATION - 0.05);
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        const playing = elapsed !== null;
        if (playing) {
            this.time = elapsed;
        }

        const radius = arenaRadius(this.time);
        this.arena.radius = radius;
        this.arenaMesh.scale.set(radius / START_RADIUS, 1, radius / START_RADIUS);
        this.sweeper.rotation.y = sweeperAngle(this.time);
        this.sweeper.scale.set(radius / START_RADIUS, 1, 1);
        this.sweeper.visible = this.time >= SWEEPER_FROM || !playing;
        this.bumpCooldown -= dt;

        if (this.outAt === null) {
            this.stage.movePlayer(dt, input, playing);

            if (playing) {
                this.checkSweeper(radius);
                this.checkDashHits();
            }

            if (this.stage.player.state.position.y < -3) {
                this.knockOut();
            }
        }

        this.stage.updateShared(dt, this.getScore(), this.outAt !== null, () => this.hitPayload());
        const feet = this.stage.position;
        this.stage.follow(new THREE.Vector3(feet.x * 0.25, 0, feet.z * 0.25 + 1), dt);
    }

    isOver(): boolean {
        return this.outAt !== null;
    }

    getResult(): MinigameResult {
        const survived = this.outAt ?? this.time;

        return {
            score: this.getScore(),
            title: this.outAt === null ? 'Last one standing!' : 'Splash down!',
            stats: [
                { label: 'Time on the ring', value: `${survived.toFixed(1)}s` },
                { label: 'Players shoved', value: String(this.knockouts) },
            ],
        };
    }

    resize(width: number, height: number): void {
        this.stage.resize(width, height);
    }

    dispose(): void {
        this.unsubscribe?.();
        this.stage.dispose();
    }

    private now(): number {
        return this.context.network ? this.context.network.serverNow() : this.time * 1000;
    }

    /** The bar sweeps round; touching it while on the ground launches you. Jump over it! */
    private checkSweeper(radius: number): void {
        if (this.time < SWEEPER_FROM || this.bumpCooldown > 0) {
            return;
        }

        const { position } = this.stage.player.state;
        if (position.y > SWEEPER_HEIGHT + 0.2) {
            return;
        }

        const angle = this.sweeper.rotation.y;
        const dirX = Math.cos(angle);
        const dirZ = -Math.sin(angle);
        const along = position.x * dirX + position.z * dirZ;
        const perpendicular = position.x * -dirZ + position.z * dirX;

        if (Math.abs(along) > radius || Math.abs(perpendicular) > 0.75) {
            return;
        }

        // Pushed in the direction the bar is turning on that side.
        const side = Math.sign(along) || 1;
        this.stage.player.knockback(-dirZ * side * 11, dirX * side * 11, 6);
        this.bumpCooldown = 0.6;
        this.stage.rig.shake(0.4);
        audio.play('bump', 1.4);
    }

    /** While dashing, bumping into someone sends them flying (on their own client). */
    private checkDashHits(): void {
        const state = this.stage.player.state;
        const network = this.context.network;

        if (!network || state.dashTimer <= 0 || !this.stage.remotes) {
            return;
        }

        for (const remote of network.remotePlayers) {
            const other = this.stage.remotes.positionOf(remote.id);

            if (!other) {
                continue;
            }

            const dx = other.x - state.position.x;
            const dz = other.z - state.position.z;
            const distance = Math.hypot(dx, dz);
            const recent = this.hitsSent.some((hit) => hit.target === remote.id && this.now() - hit.time < 400);

            if (distance < 1.25 && !recent) {
                this.hitsSent.push({ target: remote.id, dx: Math.round((dx / (distance || 1)) * 100), dz: Math.round((dz / (distance || 1)) * 100), time: Math.round(this.now()) });
                this.knockouts++;
                state.velocity.x *= -0.3;
                state.velocity.z *= -0.3;
                this.stage.effects.poof(new THREE.Vector3(other.x, 0.8, other.z));
                audio.play('bump', 1.5);
            }
        }
    }

    private hitPayload(): number[] {
        const now = this.now();

        while (this.hitsSent.length && now - this.hitsSent[0].time > HIT_BROADCAST_MS) {
            this.hitsSent.shift();
        }

        return this.hitsSent.flatMap((hit) => [hit.target, hit.dx, hit.dz, hit.time]);
    }

    private receiveHits(playerId: number, payload: number[] | undefined): void {
        if (!payload || this.outAt !== null) {
            return;
        }

        for (let index = 0; index + 3 < payload.length; index += 4) {
            const [target, dx, dz, time] = payload.slice(index, index + 4);
            const key = `${playerId}:${time}`;

            if (target !== this.context.network?.localPlayerId || this.hitsReceived.has(key)) {
                continue;
            }

            this.hitsReceived.add(key);
            this.stage.player.knockback((dx / 100) * SHOVE_SPEED, (dz / 100) * SHOVE_SPEED, 5);
            this.stage.rig.shake(0.5);
            this.context.hud.callout('Bonk!', 'bad');
            audio.play('bump', 1.5);
        }
    }

    private knockOut(): void {
        this.outAt = this.time;
        this.context.hud.callout('Splash!', 'bad');
        this.stage.effects.poof(this.stage.position.clone());
        this.stage.player.model.root.visible = false;
        audio.play('out');
    }

    private createArena(): THREE.Group {
        const group = new THREE.Group();
        const top = new THREE.Mesh(new THREE.CylinderGeometry(START_RADIUS, START_RADIUS, 0.6, 64), toonMaterial(palette.sky));
        top.position.y = -0.3;
        top.receiveShadow = true;
        addOutline(top);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(START_RADIUS - 0.3, 0.25, 10, 64), toonMaterial(palette.white));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.02;
        const centre = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), toonMaterial(palette.sun));
        centre.rotation.x = -Math.PI / 2;
        centre.position.y = 0.01;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(START_RADIUS * 0.95, START_RADIUS * 0.4, 4, 32), toonMaterial(palette.rock));
        base.position.y = -2.6;
        group.add(top, ring, centre, base);

        for (let index = 0; index < 16; index++) {
            const angle = (index / 16) * Math.PI * 2;
            const light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), toonMaterial(partyColors[index % partyColors.length]));
            light.position.set(Math.cos(angle) * (START_RADIUS - 0.3), 0.25, Math.sin(angle) * (START_RADIUS - 0.3));
            group.add(light);
        }

        const water = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 0.5, 48), toonMaterial(0x7fd6ff));
        water.position.y = -5;
        this.stage.scene.add(water);

        return group;
    }

    private createSweeper(): THREE.Group {
        const group = new THREE.Group();
        const bar = new THREE.Mesh(new RoundedBoxGeometry(START_RADIUS * 2, 0.5, 0.5, 2, 0.2), toonMaterial(palette.coral));
        bar.position.y = SWEEPER_HEIGHT - 0.25;
        bar.castShadow = true;
        addOutline(bar);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.3, 20), toonMaterial(palette.ink));
        hub.position.y = 0.65;
        group.add(bar, hub);
        this.world.addCylinder(0, 0, 0, 0.8, 1.3, { walkable: true });

        return group;
    }
}

export const createBumperSumo: MinigameFactory = (context) => new BumperSumo(context);
