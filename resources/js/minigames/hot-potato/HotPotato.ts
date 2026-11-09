import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { CharacterController } from '../../characters/CharacterController';
import { CharacterModel } from '../../characters/CharacterModel';
import { createNameTag } from '../../characters/NameTag';
import { ROSTER } from '../../characters/roster';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette, partyColors } from '../../design/palette';
import { StaticWorld } from '../../world/StaticWorld';
import { MinigameStage, NEUTRAL_INPUT } from '../shared/MinigameStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { ARENA_RADIUS, firstHolder, LAST_STANDING_BONUS, MAX_PASS_POINTS, PASS_COOLDOWN, PASS_POINTS, planFuses, SURVIVE_POINTS, type FuseRound } from './rules';

const PASS_REACH = 1.15;
const PASS_REPEAT_MS = 1500;

interface Bot {
    id: number;
    controller: CharacterController;
    wander: number;
}

interface PassEvent {
    round: number;
    seq: number;
    to: number;
    time: number;
}

/**
 * Hot Potato: whoever holds the bomb when it blows is out. Touch someone
 * to pass it on. Only the current holder can pass, so the holder's client
 * decides; everyone else follows the numbered pass events. In solo play
 * three computer players join in.
 */
class HotPotato implements Minigame {
    private readonly world = new StaticWorld();
    private readonly stage: MinigameStage;
    private readonly rounds: FuseRound[];
    private readonly bots: Bot[] = [];
    private readonly out = new Set<number>();
    private readonly bomb: THREE.Group;
    private readonly fuseSpark: THREE.Mesh;
    private readonly sentPasses: PassEvent[] = [];
    private readonly unsubscribe: (() => void) | null = null;
    private readonly myId: number;
    private roundIndex = -1;
    private holder: number | null = null;
    private passSeq = 0;
    private holdTime = 0;
    private time = 0;
    private score = 0;
    private passes = 0;
    private survived = 0;
    private tickTimer = 0;
    private eliminated = false;

    constructor(private readonly context: MinigameContext) {
        this.rounds = planFuses(context.seed);
        this.myId = context.network?.localPlayerId ?? 0;

        const angleFor = (seat: number): THREE.Vector3 => {
            const angle = (seat / 4) * Math.PI * 2;
            return new THREE.Vector3(Math.sin(angle) * 4, 0, Math.cos(angle) * 4);
        };

        this.stage = new MinigameStage(context, {
            world: this.world,
            spawn: (seat) => angleFor(seat),
            framing: { distance: 10, height: 14, portraitDistance: 15, portraitHeight: 22 },
            obstacles: () => this.botObstacles(),
        });
        this.buildArena();

        if (!context.network) {
            this.addBots(angleFor);
        }

        this.bomb = this.createBomb();
        this.fuseSpark = this.bomb.getObjectByName('spark') as THREE.Mesh;
        this.stage.scene.add(this.bomb);

        if (context.network) {
            this.unsubscribe = context.network.onSnapshot((playerId, snapshot) => {
                this.receivePasses(snapshot.e);
                if (snapshot.o === 1) {
                    this.out.add(playerId);
                }
            });
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
            this.advanceRounds();
        }

        this.holdTime += dt;

        if (!this.eliminated) {
            this.stage.movePlayer(dt, input, playing);
        }

        this.updateBots(dt, playing);

        if (playing && this.holder !== null) {
            this.tryPass();
        }

        this.updateBomb(dt);
        this.stage.updateShared(dt, this.score, this.eliminated, () => this.passPayload());
        const feet = this.stage.position;
        this.stage.follow(new THREE.Vector3(feet.x * 0.3, 0, feet.z * 0.3 + 1), dt);
    }

    isOver(): boolean {
        if (this.context.network) {
            return false;
        }

        return this.eliminated || this.activeIds().length <= 1;
    }

    getResult(): MinigameResult {
        const lastStanding = !this.eliminated && this.activeIds().length === 1;

        return {
            score: this.score,
            title: this.eliminated ? 'Kaboom!' : lastStanding ? 'Last one standing!' : 'Too hot to handle!',
            stats: [
                { label: 'Explosions survived', value: String(this.survived) },
                { label: 'Bomb passes', value: String(this.passes) },
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

    private allIds(): number[] {
        return [this.myId, ...(this.context.network?.remotePlayers.map((player) => player.id) ?? []), ...this.bots.map((bot) => bot.id)];
    }

    private activeIds(): number[] {
        return this.allIds().filter((id) => !this.out.has(id) && (this.context.network ? id === this.myId || this.context.network.isOnline(id) : true));
    }

    private positionOf(id: number): THREE.Vector3 | null {
        if (id === this.myId) {
            return this.eliminated ? null : this.stage.position;
        }

        const bot = this.bots.find((candidate) => candidate.id === id);
        if (bot) {
            return this.out.has(id) ? null : bot.controller.position;
        }

        return this.stage.remotes?.positionOf(id) ?? null;
    }

    private advanceRounds(): void {
        const current = this.rounds[this.roundIndex];

        if (current && this.holder !== null && this.time >= current.explodesAt) {
            this.explode(this.holder);
        }

        const next = this.rounds[this.roundIndex + 1];
        if (next && this.time >= next.startsAt && (current === undefined || this.time >= current.explodesAt)) {
            this.roundIndex++;
            this.passSeq = 0;
            this.setHolder(firstHolder(next, this.activeIds()));
            this.context.hud.callout('Hot potato!', 'neutral');
            audio.play('pop');
        }
    }

    private setHolder(id: number | null): void {
        this.holder = id;
        this.holdTime = 0;
    }

    /** Only the holder may pass. Bots pass for themselves in solo play. */
    private tryPass(): void {
        const holder = this.holder;
        const isBot = this.bots.some((bot) => bot.id === holder);

        if (holder === null || (holder !== this.myId && !isBot) || this.holdTime < PASS_COOLDOWN) {
            return;
        }

        const from = this.positionOf(holder);
        if (!from) {
            return;
        }

        for (const id of this.activeIds()) {
            const target = this.positionOf(id);

            if (id === holder || !target || Math.hypot(target.x - from.x, target.z - from.z) > PASS_REACH) {
                continue;
            }

            this.passSeq++;
            this.setHolder(id);
            this.sentPasses.push({ round: this.roundIndex, seq: this.passSeq, to: id, time: this.now() });
            this.stage.effects.poof(target.clone().setY(1.6));
            audio.play('bump');

            if (holder === this.myId) {
                this.passes++;
                this.score += this.passes * PASS_POINTS <= MAX_PASS_POINTS ? PASS_POINTS : 0;
                this.context.hud.setScore(this.score);
                this.context.hud.callout('Passed!', 'good');
            }

            if (id === this.myId) {
                this.context.hud.callout('You have it! Pass it on!', 'bad');
            }
            return;
        }
    }

    private passPayload(): number[] {
        const now = this.now();
        return this.sentPasses.filter((pass) => now - pass.time < PASS_REPEAT_MS).flatMap((pass) => [pass.round, pass.seq, pass.to]);
    }

    private receivePasses(payload: number[] | undefined): void {
        if (!payload) {
            return;
        }

        for (let index = 0; index + 2 < payload.length; index += 3) {
            const [round, seq, to] = payload.slice(index, index + 3);

            if (round === this.roundIndex && seq > this.passSeq) {
                this.passSeq = seq;
                this.setHolder(to);
                if (to === this.myId) {
                    this.context.hud.callout('You have it! Pass it on!', 'bad');
                    audio.play('bump');
                }
            }
        }
    }

    private explode(holder: number): void {
        const position = this.positionOf(holder)?.clone() ?? new THREE.Vector3();
        this.stage.effects.poof(position.clone().setY(1));
        this.stage.effects.confetti(position.clone().setY(1.5), 40);
        this.stage.rig.shake(0.8);
        audio.play('out');

        this.out.add(holder);
        this.setHolder(null);

        if (holder === this.myId) {
            this.eliminated = true;
            this.stage.player.model.root.visible = false;
            this.context.hud.callout('Kaboom! You are out', 'bad');
            return;
        }

        const bot = this.bots.find((candidate) => candidate.id === holder);
        if (bot) {
            bot.controller.model.root.visible = false;
        }

        if (!this.eliminated) {
            this.survived++;
            this.score += SURVIVE_POINTS;

            if (this.activeIds().length === 1) {
                this.score += LAST_STANDING_BONUS;
                this.context.hud.callout(`Last one standing! +${LAST_STANDING_BONUS + SURVIVE_POINTS}`, 'good');
            } else {
                this.context.hud.callout(`Survived! +${SURVIVE_POINTS}`, 'good');
            }

            this.context.hud.setScore(this.score);
        }
    }

    private updateBomb(dt: number): void {
        const position = this.holder !== null ? this.positionOf(this.holder) : null;
        this.bomb.visible = position !== null;

        if (!position) {
            return;
        }

        this.bomb.position.set(position.x, position.y + 2.3 + Math.sin(this.time * 12) * 0.05, position.z);
        this.bomb.rotation.y += dt * 2;

        const round = this.rounds[this.roundIndex];
        const left = round ? round.explodesAt - this.time : 10;
        const urgency = Math.min(1, Math.max(0, 1 - left / 8));
        this.fuseSpark.scale.setScalar(0.8 + Math.random() * 0.6 + urgency);
        this.bomb.scale.setScalar(1 + Math.sin(this.time * (6 + urgency * 20)) * 0.06 * (1 + urgency));

        this.tickTimer -= dt;
        if (this.tickTimer <= 0) {
            this.tickTimer = 0.15 + (1 - urgency) * 0.6;
            audio.play('tick', 0.4 + urgency * 0.6);
        }
    }

    /** Solo opponents: run from the bomb, or chase the nearest player when holding it. */
    private addBots(angleFor: (seat: number) => THREE.Vector3): void {
        const characters = ROSTER.filter((character) => character.id !== this.context.character.id);

        characters.slice(0, 3).forEach((character, index) => {
            const model = new CharacterModel(character, null);
            model.root.add(createNameTag(character.name, character.body));
            this.stage.scene.add(model.root);
            const spawn = angleFor(index + 1);
            const controller = new CharacterController(model, this.world, spawn, { maxSpeed: 5.6 });
            controller.teleport(spawn, Math.PI);
            this.bots.push({ id: -(index + 1), controller, wander: Math.random() * Math.PI * 2 });
        });
    }

    private updateBots(dt: number, playing: boolean): void {
        for (const bot of this.bots) {
            if (this.out.has(bot.id)) {
                continue;
            }

            const me = bot.controller.position;
            let moveX = 0;
            let moveZ = 0;

            if (playing && this.holder === bot.id) {
                const target = this.nearestOther(bot.id);
                if (target) {
                    moveX = target.x - me.x;
                    moveZ = target.z - me.z;
                }
            } else if (playing && this.holder !== null) {
                const danger = this.positionOf(this.holder);
                if (danger) {
                    moveX = me.x - danger.x;
                    moveZ = me.z - danger.z;
                }
                // Stay away from the edge.
                moveX -= me.x * 0.15;
                moveZ -= me.z * 0.15;
            } else {
                bot.wander += dt * 0.7;
                moveX = Math.sin(bot.wander);
                moveZ = Math.cos(bot.wander);
            }

            const length = Math.hypot(moveX, moveZ) || 1;
            // Bots read world directions; convert to the controller's camera-relative input with yaw 0.
            bot.controller.update(dt, { ...NEUTRAL_INPUT, moveX: moveX / length, moveY: -moveZ / length }, 0);
        }
    }

    private nearestOther(id: number): THREE.Vector3 | null {
        const from = this.positionOf(id);
        let best: THREE.Vector3 | null = null;
        let bestDistance = Infinity;

        for (const other of this.activeIds()) {
            const position = this.positionOf(other);
            if (other !== id && position && from) {
                const distance = position.distanceTo(from);
                if (distance < bestDistance) {
                    best = position;
                    bestDistance = distance;
                }
            }
        }

        return best;
    }

    private botObstacles(): { x: number; y: number; z: number; radius: number }[] {
        return this.bots.filter((bot) => !this.out.has(bot.id)).map((bot) => ({ x: bot.controller.position.x, y: bot.controller.position.y, z: bot.controller.position.z, radius: 0.45 }));
    }

    private createBomb(): THREE.Group {
        const bomb = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), toonMaterial(palette.ink));
        addOutline(body).scale.setScalar(1.06);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toonMaterial(palette.white));
        shine.position.set(-0.18, 0.2, 0.32);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.16, 10), toonMaterial(palette.rock));
        cap.position.y = 0.48;
        const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), toonMaterial(0xc98a5a));
        fuse.position.set(0.05, 0.68, 0);
        fuse.rotation.z = -0.3;
        const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), toonMaterial(palette.sun));
        spark.name = 'spark';
        spark.position.set(0.1, 0.85, 0);
        bomb.add(body, shine, cap, fuse, spark);

        return bomb;
    }

    private buildArena(): void {
        const scene = this.stage.scene;
        const floor = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 0.6, ARENA_RADIUS, 1.2, 48), toonMaterial(0xffd9a8));
        floor.position.y = -0.6;
        floor.receiveShadow = true;
        addOutline(floor);
        scene.add(floor);
        this.world.addCylinder(0, -1.2, 0, ARENA_RADIUS + 0.6, 1.2);

        for (let index = 0; index < 20; index++) {
            const angle = (index / 20) * Math.PI * 2;
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1, 10), toonMaterial(partyColors[index % partyColors.length]));
            post.position.set(Math.cos(angle) * (ARENA_RADIUS + 0.3), 0.5, Math.sin(angle) * (ARENA_RADIUS + 0.3));
            post.castShadow = true;
            scene.add(post);
        }

        for (let index = 0; index < 36; index++) {
            const angle = (index / 36) * Math.PI * 2;
            this.world.addCylinder(Math.cos(angle) * (ARENA_RADIUS + 0.8), 0, Math.sin(angle) * (ARENA_RADIUS + 0.8), 0.7, 3, { walkable: false });
        }

        const rings = new THREE.Mesh(new THREE.RingGeometry(2, 2.4, 48), toonMaterial(palette.coral));
        rings.rotation.x = -Math.PI / 2;
        rings.position.y = 0.01;
        scene.add(rings);
    }
}

export const createHotPotato: MinigameFactory = (context) => new HotPotato(context);
