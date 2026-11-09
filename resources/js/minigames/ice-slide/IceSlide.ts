import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette } from '../../design/palette';
import { el } from '../../ui/dom';
import { StaticWorld } from '../../world/StaticWorld';
import { MinigameStage, NEUTRAL_INPUT } from '../shared/MinigameStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { ICE_FRICTION, IDEAL_SPEED, pointsFor, RINGS, RINK_END_Z, RINK_HALF_WIDTH, RUN_MAX_SPEED, START_DEPTH, TARGET_Z } from './rules';

type Phase = 'run-up' | 'sliding' | 'scored';

const LANES = [-2.4, -0.8, 0.8, 2.4];

/**
 * Ice Slide: run up, cross the line and glide. Once you are on the ice
 * you can only nudge left and right, so the speed at the line decides
 * where you stop. Closest to the centre scores most.
 */
class IceSlide implements Minigame {
    private readonly world = new StaticWorld();
    private readonly stage: MinigameStage;
    private readonly gauge: HTMLElement;
    private readonly gaugeFill: HTMLElement;
    private readonly markers: THREE.Mesh[] = [];
    private readonly lane: number;
    private phase: Phase = 'run-up';
    private phaseTime = 0;
    private stillTime = 0;
    private score = 0;
    private attempts = 0;
    private bestDistance: number | null = null;

    constructor(private readonly context: MinigameContext) {
        this.lane = context.network ? LANES[context.network.localSeat % LANES.length] : 0;

        this.stage = new MinigameStage(context, {
            world: this.world,
            spawn: () => new THREE.Vector3(this.lane, 0, START_DEPTH - 1),
            framing: { distance: 9, height: 9.5, portraitDistance: 13, portraitHeight: 13 },
        });
        this.stage.rig.options.lookHeight = 1;
        this.buildRink();
        this.useRunUpGrip();

        this.gaugeFill = el('span', { className: 'ice-gauge__fill' });
        const ideal = el('span', { className: 'ice-gauge__ideal' });
        ideal.style.left = `${(IDEAL_SPEED / RUN_MAX_SPEED) * 100}%`;
        this.gauge = el('div', { className: 'ice-gauge' }, [el('span', { className: 'ice-gauge__label', text: 'Speed' }), el('span', { className: 'ice-gauge__track' }, [this.gaugeFill, ideal])]);
        context.overlay.append(this.gauge);

        this.stage.follow(this.cameraTarget(), 0, true);
    }

    get scene(): THREE.Scene {
        return this.stage.scene;
    }

    get camera(): THREE.Camera {
        return this.stage.camera;
    }

    start(): void {
        this.attempts = 0;
    }

    getScore(): number {
        return this.score;
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        const playing = elapsed !== null;

        this.phaseTime += dt;
        const state = this.stage.player.state;

        if (this.phase === 'run-up') {
            this.stage.movePlayer(dt, { ...input, actionPressed: false }, playing, false);

            if (playing && state.position.z < 0) {
                this.release();
            }
        }

        if (this.phase === 'sliding') {
            const steer = playing ? { ...NEUTRAL_INPUT, moveX: input.moveX * 0.4 } : NEUTRAL_INPUT;
            this.stage.movePlayer(dt, steer, playing, false);
            this.followSlide(dt);
        }

        if (this.phase === 'scored') {
            this.stage.movePlayer(dt, NEUTRAL_INPUT, false);

            if (this.phaseTime > 1.4) {
                this.reset();
            }
        }

        const speed = Math.hypot(state.velocity.x, state.velocity.z);
        this.gaugeFill.style.transform = `scaleX(${Math.min(1, speed / RUN_MAX_SPEED)})`;
        this.gauge.classList.toggle('is-hidden', this.phase !== 'run-up');

        this.stage.updateShared(dt, this.score, false);
        this.stage.follow(this.cameraTarget(), dt);
    }

    isOver(): boolean {
        return false;
    }

    getResult(): MinigameResult {
        return {
            score: this.score,
            title: this.bestDistance !== null && this.bestDistance < RINGS[0].radius ? 'Ice cold precision!' : 'Slip sliding away!',
            stats: [
                { label: 'Slides', value: String(this.attempts) },
                { label: 'Closest to the centre', value: this.bestDistance === null ? 'None' : `${this.bestDistance.toFixed(2)} m` },
            ],
        };
    }

    resize(width: number, height: number): void {
        this.stage.resize(width, height);
    }

    dispose(): void {
        this.gauge.remove();
        this.stage.dispose();
    }

    /** Normal grip behind the line: you can build up exactly the speed you want. */
    private useRunUpGrip(): void {
        const config = this.stage.player.config;
        config.maxSpeed = RUN_MAX_SPEED;
        config.acceleration = 11;
        config.deceleration = 22;
        config.airControl = 0.55;
    }

    /** Over the line: almost no grip, only gentle steering. */
    private release(): void {
        this.phase = 'sliding';
        this.phaseTime = 0;
        this.stillTime = 0;
        const config = this.stage.player.config;
        config.acceleration = ICE_FRICTION;
        config.deceleration = ICE_FRICTION;
        config.airControl = 0;
        this.stage.effects.dash(this.stage.position.clone().setY(0.3), this.context.character.body);
        audio.play('dash');
    }

    private followSlide(dt: number): void {
        const { position, velocity } = this.stage.player.state;
        const speed = Math.hypot(velocity.x, velocity.z);

        if (Math.random() < dt * speed * 2) {
            this.stage.effects.jump(new THREE.Vector3(position.x, 0.05, position.z + 0.4));
        }

        if (position.y < -1.5 || position.z < RINK_END_Z - 0.5) {
            this.finishAttempt(null);
            return;
        }

        this.stillTime = speed < 0.15 ? this.stillTime + dt : 0;

        if (this.stillTime > 0.4) {
            this.finishAttempt(Math.hypot(position.x, position.z - TARGET_Z));
        }
    }

    private finishAttempt(distance: number | null): void {
        this.phase = 'scored';
        this.phaseTime = 0;
        this.attempts++;

        const { points, label } = distance === null ? { points: 0, label: 'Off the end!' } : pointsFor(distance);
        this.score += points;
        this.context.hud.setScore(this.score);
        this.context.hud.callout(points > 0 ? `${label} +${points}` : label, points > 0 ? 'good' : 'bad');

        if (distance !== null) {
            this.bestDistance = this.bestDistance === null ? distance : Math.min(this.bestDistance, distance);
            this.dropMarker();
        }

        if (points >= 100) {
            this.stage.effects.confetti(this.stage.position.clone().setY(1.5), points >= 150 ? 60 : 30);
        }

        audio.play(points >= 150 ? 'win' : points > 0 ? 'score' : 'wrong');
    }

    private reset(): void {
        this.phase = 'run-up';
        this.phaseTime = 0;
        this.useRunUpGrip();
        const spawn = new THREE.Vector3(this.lane, 0, START_DEPTH - 1);
        this.stage.player.teleport(spawn, Math.PI);
        this.stage.effects.poof(spawn.clone().setY(0.5));
    }

    /** Leaves a puck-shaped mark where you stopped. */
    private dropMarker(): void {
        const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), toonMaterial(this.context.character.body));
        marker.position.set(this.stage.position.x, 0.04, this.stage.position.z);
        addOutline(marker);
        this.stage.scene.add(marker);
        this.markers.push(marker);
    }

    private cameraTarget(): THREE.Vector3 {
        const feet = this.stage.position;
        return new THREE.Vector3(feet.x * 0.3, 0, Math.min(feet.z, 2) - 3);
    }

    private buildRink(): void {
        const scene = this.stage.scene;
        const length = START_DEPTH - RINK_END_Z;
        const centerZ = (START_DEPTH + RINK_END_Z) / 2;

        const ice = new THREE.Mesh(new THREE.BoxGeometry(RINK_HALF_WIDTH * 2, 1, length), toonMaterial(0xd8f3ff));
        ice.position.set(0, -0.5, centerZ);
        ice.receiveShadow = true;
        scene.add(ice);
        this.world.addBox({ x: 0, y: -0.5, z: centerZ }, { x: RINK_HALF_WIDTH * 2, y: 1, z: length });

        const runUp = new THREE.Mesh(new THREE.PlaneGeometry(RINK_HALF_WIDTH * 2, START_DEPTH), toonMaterial(0xb7c3ea));
        runUp.rotation.x = -Math.PI / 2;
        runUp.position.set(0, 0.01, START_DEPTH / 2);
        runUp.receiveShadow = true;
        scene.add(runUp);

        const line = new THREE.Mesh(new THREE.PlaneGeometry(RINK_HALF_WIDTH * 2, 0.25), toonMaterial(palette.coral));
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.02, 0);
        scene.add(line);

        const colors = [palette.coral, palette.white, palette.sky, palette.white];
        [...RINGS].reverse().forEach((ring, index) => {
            const disc = new THREE.Mesh(new THREE.CircleGeometry(ring.radius, 48), toonMaterial(colors[(RINGS.length - 1 - index) % colors.length]));
            disc.rotation.x = -Math.PI / 2;
            disc.position.set(0, 0.015 + index * 0.002, TARGET_Z);
            disc.receiveShadow = true;
            scene.add(disc);
        });

        const bankMaterial = toonMaterial(palette.white);
        for (const side of [-1, 1]) {
            const bank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, length, 12), bankMaterial);
            bank.rotation.x = Math.PI / 2;
            bank.position.set(side * (RINK_HALF_WIDTH + 0.4), 0.2, centerZ);
            addOutline(bank);
            scene.add(bank);
            this.world.addBox({ x: side * (RINK_HALF_WIDTH + 0.4), y: 1, z: centerZ }, { x: 0.8, y: 2.4, z: length }, { walkable: false });
        }

        this.world.addBox({ x: 0, y: 1, z: START_DEPTH + 0.3 }, { x: RINK_HALF_WIDTH * 2, y: 2.4, z: 0.6 }, { walkable: false });

        for (let index = 0; index < 10; index++) {
            const flag = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 4), toonMaterial(index % 2 ? palette.sky : palette.coral));
            flag.position.set((index % 2 ? 1 : -1) * (RINK_HALF_WIDTH + 0.4), 1, -index * 3.5);
            scene.add(flag);
        }
    }
}

export const createIceSlide: MinigameFactory = (context) => new IceSlide(context);
