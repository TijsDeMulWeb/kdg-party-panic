import * as THREE from 'three';
import { CameraRig } from '../../core/CameraRig';
import type { InputSnapshot } from '../../core/InputManager';
import { audio } from '../../audio/AudioManager';
import { CharacterController } from '../../characters/CharacterController';
import { CharacterModel } from '../../characters/CharacterModel';
import { createCloudLayer, createLighting, createSky, type CloudLayer } from '../../design/environment';
import { Effects } from '../../effects/Effects';
import { StaticWorld } from '../../world/StaticWorld';
import { WorldWithMovingObstacles } from '../../world/WorldWithMovingObstacles';
import { createNameTag } from '../../characters/NameTag';
import { RemoteCharacters } from '../../multiplayer/RemoteCharacters';
import { SnapshotSender } from '../../multiplayer/SnapshotSender';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { ColorArena } from './ColorArena';
import { CRASH_COLORS } from './colors';
import { planRounds, reactionBonus, ROUND_POINTS, WARNING_TIME, type RoundPlan } from './rounds';
import { TargetBanner } from './TargetBanner';

const ELIMINATION_HEIGHT = -2.5;
const NEUTRAL_INPUT: InputSnapshot = {
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    jumpHeld: false,
    actionPressed: false,
    actionHeld: false,
    lookX: 0,
    lookY: 0,
};

/** Centre tile in solo; one tile per seat around the centre in multiplayer. */
function spawnTile(seat: number | undefined): number {
    const seatTiles = [16, 18, 30, 32];

    return seat === undefined ? 24 : seatTiles[seat % seatTiles.length];
}

type RoundStep = 'waiting' | 'choosing' | 'warned' | 'dropped' | 'resolved';

/**
 * Color Crash: a colour is announced, every other tile drops.
 * Stand on the right colour to survive; arrive early for a bonus.
 */
export class ColorCrash implements Minigame {
    readonly scene = new THREE.Scene();
    private readonly rig = new CameraRig({ distance: 12, height: 19, lookHeight: 0, rotateSpeed: 0, followSharpness: 3 });
    readonly camera = this.rig.camera;

    private readonly world = new StaticWorld();
    private readonly arena: ColorArena;
    private readonly player: CharacterController;
    private readonly effects: Effects;
    private readonly clouds: CloudLayer;
    private readonly banner = new TargetBanner();
    private readonly plans: RoundPlan[];
    private readonly cameraTarget = new THREE.Vector3();

    private readonly remotes: RemoteCharacters | null = null;
    private readonly snapshots: SnapshotSender | null = null;
    private time = 0;
    private visualTime = 0;
    private roundIndex = 0;
    private step: RoundStep = 'waiting';
    private arrivedAt: number | null = null;
    private score = 0;
    private roundsSurvived = 0;
    private bestReaction: number | null = null;
    private eliminated = false;

    constructor(private readonly context: MinigameContext) {
        this.plans = planRounds(context.seed);

        this.scene.add(createSky());
        createLighting(this.scene, 13);
        this.clouds = createCloudLayer(16, 25, 70, -24, -6);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);

        this.arena = new ColorArena(this.world);
        this.arena.applyLayout(this.plans[0].tiles);
        this.scene.add(this.arena.group);

        const spawn = this.arena.tilePosition(spawnTile(context.network?.localSeat));
        const model = new CharacterModel(context.character, context.hat);
        this.scene.add(model.root);

        if (context.network) {
            this.remotes = new RemoteCharacters(this.scene, context.network, (position) => this.effects.poof(position));
            this.snapshots = new SnapshotSender(context.network);
            model.root.add(createNameTag('You', context.character.body, true, 1.7));
        }

        const world = this.remotes ? new WorldWithMovingObstacles(this.world, () => this.remotes?.obstacles() ?? []) : this.world;
        this.player = new CharacterController(model, world, spawn);
        this.player.teleport(spawn, Math.PI);

        context.overlay.append(this.banner.root);
        this.updateCamera(0, true);
    }

    start(): void {
        this.time = 0;
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        const playing = elapsed !== null;
        this.visualTime += dt;

        if (playing) {
            this.time = elapsed;
            this.advanceRounds();
        }

        if (!this.eliminated) {
            this.updatePlayer(dt, playing ? input : NEUTRAL_INPUT);
        }

        this.remotes?.update(dt);
        this.snapshots?.update(dt, this.player, this.eliminated, this.score);

        this.arena.update(dt, this.visualTime);
        this.updateCamera(dt, false);
        this.clouds.update(dt);
        this.effects.update(dt);
    }

    getScore(): number {
        return this.score;
    }

    isOver(): boolean {
        const lastRound = this.plans[this.plans.length - 1];

        return this.eliminated || this.time >= lastRound.restoreAt + 0.3;
    }

    getResult(): MinigameResult {
        return {
            score: this.score,
            title: this.eliminated ? 'Splat!' : 'Survived!',
            stats: [
                { label: 'Colours survived', value: `${this.roundsSurvived} / ${this.plans.length}` },
                { label: 'Fastest reaction', value: this.bestReaction === null ? 'None' : `${this.bestReaction.toFixed(2)}s` },
            ],
        };
    }

    resize(width: number, height: number): void {
        this.rig.resize(width, height);
        // Portrait screens need more distance to fit the arena's width.
        if (width < height) {
            this.rig.setFraming(20, 31);
        } else {
            this.rig.setFraming(12, 19);
        }
    }

    dispose(): void {
        this.banner.root.remove();
        this.remotes?.dispose();
    }

    /** Fires each round's announce → warn → drop → resolve steps on schedule. */
    private advanceRounds(): void {
        const plan = this.plans[this.roundIndex];

        if (!plan) {
            return;
        }

        if (this.step === 'waiting' && this.time >= plan.startsAt) {
            this.announce(plan);
        }

        if (this.step === 'choosing') {
            this.banner.setProgress(1 - (this.time - plan.startsAt) / plan.chooseTime);
            this.trackArrival(plan);

            if (this.time >= plan.dropAt - WARNING_TIME) {
                this.arena.warn(plan.target);
                this.step = 'warned';
            }
        }

        if (this.step === 'warned') {
            this.banner.setProgress(1 - (this.time - plan.startsAt) / plan.chooseTime);
            this.trackArrival(plan);

            if (this.time >= plan.dropAt) {
                this.drop(plan);
            }
        }

        if (this.step === 'dropped' && this.time >= plan.restoreAt) {
            this.resolve(plan);
        }

        if (this.step === 'resolved' && this.time >= plan.endsAt) {
            this.roundIndex++;
            this.step = 'waiting';
        }
    }

    private announce(plan: RoundPlan): void {
        const color = CRASH_COLORS[plan.target];
        this.step = 'choosing';
        this.arrivedAt = null;
        this.banner.show(color);
        audio.play('pop');
    }

    /** Remembers when the player settled on a safe tile, for the reaction bonus. */
    private trackArrival(plan: RoundPlan): void {
        if (this.eliminated || !this.player.state.grounded) {
            return;
        }

        const { x, z } = this.player.state.position;
        const tile = this.arena.tileAt(x, z);
        const safe = tile !== null && this.arena.colorOf(tile) === plan.target;

        if (safe && this.arrivedAt === null) {
            this.arrivedAt = this.time - plan.startsAt;
        }

        if (!safe) {
            this.arrivedAt = null;
        }
    }

    private drop(plan: RoundPlan): void {
        this.step = 'dropped';
        this.banner.dropping();
        this.arena.drop(plan.target);
        this.rig.shake(0.35);
        audio.play('bump', 1.4);
    }

    private resolve(plan: RoundPlan): void {
        this.step = 'resolved';
        this.banner.hide();

        if (!this.eliminated) {
            const bonus = reactionBonus(this.arrivedAt, plan.chooseTime);
            this.score += ROUND_POINTS + bonus;
            this.roundsSurvived++;
            if (this.arrivedAt !== null && (this.bestReaction === null || this.arrivedAt < this.bestReaction)) {
                this.bestReaction = this.arrivedAt;
            }

            this.context.hud.setScore(this.score);
            this.context.hud.callout(bonus >= 35 ? `Speedy! +${ROUND_POINTS + bonus}` : `+${ROUND_POINTS + bonus}`, 'good');
            audio.play(bonus >= 35 ? 'bonus' : 'score');
            this.effects.confetti(this.player.position.clone().setY(1.5), 30);
        }

        const next = this.plans[plan.index + 1];
        this.arena.restore(next ? next.tiles : null);
    }

    private updatePlayer(dt: number, input: InputSnapshot): void {
        const events = this.player.update(dt, input, this.rig.getYaw());
        const feet = this.player.position;

        if (events.jumped) {
            this.effects.jump(feet);
        }
        if (events.landed) {
            this.effects.landing(feet, events.landingSpeed);
        }
        if (events.dashed) {
            this.effects.dash(feet.clone().setY(feet.y + 0.4), this.context.character.body);
        }

        if (feet.y < ELIMINATION_HEIGHT) {
            this.eliminate();
        }
    }

    private eliminate(): void {
        this.eliminated = true;
        this.banner.hide();
        this.context.hud.callout('Out!', 'bad');
        audio.play('out');
        this.rig.shake(0.6);
        this.effects.poof(this.player.position.clone());
        this.player.model.root.visible = false;
    }

    private updateCamera(dt: number, snap: boolean): void {
        // Mostly frame the whole arena, drift a little towards the player.
        const feet = this.player.position;
        this.cameraTarget.set(feet.x * 0.25, 0, 1 + feet.z * 0.2);

        if (snap) {
            this.rig.snap(this.cameraTarget);
        } else {
            this.rig.setTarget(this.cameraTarget);
            this.rig.update(dt);
        }
    }
}

export const createColorCrash: MinigameFactory = (context) => new ColorCrash(context);
