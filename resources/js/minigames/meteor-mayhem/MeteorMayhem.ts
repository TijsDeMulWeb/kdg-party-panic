import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { addOutline, createToonMaterial, toonMaterial } from '../../design/materials';
import { palette } from '../../design/palette';
import { ClaimBook } from '../../multiplayer/ClaimBook';
import { StaticWorld } from '../../world/StaticWorld';
import { createIsland } from '../../world/props';
import { MinigameStage } from '../shared/MinigameStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { ARENA_RADIUS, HIT_PENALTY, METEOR_RADIUS, planMeteors, planStars, STAR_LIFETIME, STAR_POINTS, WARNING_TIME, type MeteorPlan, type StarPlan } from './rules';

const STUN_TIME = 1.1;
const FALL_HEIGHT = 18;

interface LiveMeteor {
    plan: MeteorPlan;
    group: THREE.Group;
    rock: THREE.Mesh;
    shadow: THREE.Mesh;
    landed: boolean;
}

interface LiveStar {
    plan: StarPlan;
    mesh: THREE.Mesh;
}

function starShape(): THREE.Shape {
    const shape = new THREE.Shape();
    for (let index = 0; index < 10; index++) {
        const angle = Math.PI / 2 + (index / 10) * Math.PI * 2;
        const radius = index % 2 === 0 ? 0.5 : 0.22;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    return shape;
}

const starGeometry = new THREE.ExtrudeGeometry(starShape(), { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
starGeometry.center();
const rockGeometry = new THREE.IcosahedronGeometry(0.9, 1);
const shadowGeometry = new THREE.CircleGeometry(METEOR_RADIUS, 32);

/** Meteor Mayhem: dodge falling meteors, grab the stars. */
class MeteorMayhem implements Minigame {
    private readonly world = new StaticWorld();
    private readonly stage: MinigameStage;
    private readonly meteorPlans: MeteorPlan[];
    private readonly starPlans: StarPlan[];
    private readonly meteors: LiveMeteor[] = [];
    private readonly stars = new Map<number, LiveStar>();
    private readonly claims: ClaimBook;
    private nextMeteor = 0;
    private nextStar = 0;
    private time = 0;
    private score = 0;
    private starsCollected = 0;
    private hits = 0;
    private stunned = 0;

    constructor(private readonly context: MinigameContext) {
        this.meteorPlans = planMeteors(context.seed);
        this.starPlans = planStars(context.seed);

        const seats = [
            [0, 3],
            [-3, 0],
            [3, 0],
            [0, -3],
        ];
        this.stage = new MinigameStage(context, {
            world: this.world,
            spawn: (seat) => new THREE.Vector3(context.network ? seats[seat % 4][0] : 0, 0, context.network ? seats[seat % 4][1] : 2),
            framing: { distance: 11, height: 16, portraitDistance: 17, portraitHeight: 26 },
        });

        const island = createIsland(ARENA_RADIUS + 0.5, 1.4);
        this.stage.scene.add(island);
        this.world.addCylinder(0, -2, 0, ARENA_RADIUS + 0.5, 2);

        this.claims = new ClaimBook(context.network, () => this.time, (id, wasMine) => this.lostStar(id, wasMine));
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

        this.stunned = Math.max(0, this.stunned - dt);
        this.stage.movePlayer(dt, input, playing && this.stunned === 0);
        this.stage.player.model.root.rotation.y += this.stunned > 0 ? dt * 14 : 0;

        if (playing) {
            this.spawn();
            this.updateMeteors();
            this.collectStars();
        }

        this.animate(dt);

        // Fell off the island: back to the middle with a penalty.
        if (this.stage.player.state.position.y < -6) {
            this.stage.player.teleport(new THREE.Vector3(0, 0, 0));
            this.penalise();
        }

        this.stage.updateShared(dt, this.score, false, () => this.claims.payload());
        const feet = this.stage.position;
        this.stage.follow(new THREE.Vector3(feet.x * 0.3, 0, feet.z * 0.3 + 1), dt);
    }

    isOver(): boolean {
        return false;
    }

    getResult(): MinigameResult {
        return {
            score: this.score,
            title: this.hits === 0 ? 'Untouchable!' : 'Survived the storm!',
            stats: [
                { label: 'Stars collected', value: String(this.starsCollected) },
                { label: 'Meteor hits', value: String(this.hits) },
            ],
        };
    }

    resize(width: number, height: number): void {
        this.stage.resize(width, height);
    }

    dispose(): void {
        this.claims.dispose();
        this.stage.dispose();
    }

    private spawn(): void {
        while (this.nextMeteor < this.meteorPlans.length && this.meteorPlans[this.nextMeteor].impactAt - WARNING_TIME <= this.time) {
            this.meteors.push(this.createMeteor(this.meteorPlans[this.nextMeteor++]));
        }

        while (this.nextStar < this.starPlans.length && this.starPlans[this.nextStar].spawnAt <= this.time) {
            const plan = this.starPlans[this.nextStar++];

            if (this.claims.isClaimed(plan.id)) {
                continue;
            }

            const mesh = new THREE.Mesh(starGeometry, toonMaterial(palette.sun));
            addOutline(mesh).scale.setScalar(1.08);
            mesh.castShadow = true;
            mesh.position.set(plan.x, 0.8, plan.z);
            this.stage.scene.add(mesh);
            this.stars.set(plan.id, { plan, mesh });
        }
    }

    private createMeteor(plan: MeteorPlan): LiveMeteor {
        const group = new THREE.Group();
        group.position.set(plan.x, 0, plan.z);

        const shadow = new THREE.Mesh(shadowGeometry, createToonMaterial(palette.coral, { transparent: true, opacity: 0.35, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.03;
        shadow.scale.setScalar(0.1);

        const rock = new THREE.Mesh(rockGeometry, toonMaterial(0x8a5a44));
        addOutline(rock).scale.setScalar(1.06);
        const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), createToonMaterial(palette.tangerine, { transparent: true, opacity: 0.55 }));
        rock.add(glow);
        rock.position.y = FALL_HEIGHT;
        rock.castShadow = true;

        group.add(shadow, rock);
        this.stage.scene.add(group);

        return { plan, group, rock, shadow, landed: false };
    }

    private updateMeteors(): void {
        for (let index = this.meteors.length - 1; index >= 0; index--) {
            const meteor = this.meteors[index];
            const untilImpact = meteor.plan.impactAt - this.time;
            const progress = 1 - Math.max(0, untilImpact) / WARNING_TIME;

            meteor.shadow.scale.setScalar(0.1 + progress * 0.9);
            (meteor.shadow.material as THREE.MeshToonMaterial).opacity = 0.25 + progress * 0.4;
            meteor.rock.position.y = FALL_HEIGHT * Math.max(0, untilImpact / WARNING_TIME) ** 2 + 0.6;
            meteor.rock.rotation.x += 0.1;

            if (!meteor.landed && untilImpact <= 0) {
                meteor.landed = true;
                this.impact(meteor);
            }

            if (untilImpact < -0.5) {
                this.stage.scene.remove(meteor.group);
                (meteor.shadow.material as THREE.Material).dispose();
                this.meteors.splice(index, 1);
            }
        }
    }

    private impact(meteor: LiveMeteor): void {
        const center = new THREE.Vector3(meteor.plan.x, 0.4, meteor.plan.z);
        this.stage.effects.poof(center);
        this.stage.effects.landing(center, 25);

        const feet = this.stage.player.state.position;
        const dx = feet.x - meteor.plan.x;
        const dz = feet.z - meteor.plan.z;
        const distance = Math.hypot(dx, dz);
        const nearby = distance < 6;

        if (nearby) {
            audio.play('bump', 1.5 - distance / 6);
            this.stage.rig.shake(0.3 * (1 - distance / 6));
        }

        if (distance < METEOR_RADIUS + 0.3 && feet.y < 1.5 && this.stunned === 0) {
            const nx = distance > 0.01 ? dx / distance : 1;
            const nz = distance > 0.01 ? dz / distance : 0;
            this.stage.player.knockback(nx * 9, nz * 9, 7);
            this.stunned = STUN_TIME;
            this.penalise();
        }
    }

    private penalise(): void {
        this.hits++;
        this.score = Math.max(0, this.score - HIT_PENALTY);
        this.context.hud.setScore(this.score);
        this.context.hud.callout(`Bonk! -${HIT_PENALTY}`, 'bad');
        this.stage.rig.shake(0.7);
        audio.play('out');
    }

    private collectStars(): void {
        const feet = this.stage.player.state.position;

        for (const star of this.stars.values()) {
            if (this.time - star.plan.spawnAt > STAR_LIFETIME) {
                this.removeStar(star.plan.id);
                continue;
            }

            if (Math.hypot(feet.x - star.plan.x, feet.z - star.plan.z) < 1 && feet.y < 2.2 && this.claims.claim(star.plan.id)) {
                this.removeStar(star.plan.id);
                this.score += STAR_POINTS;
                this.starsCollected++;
                this.context.hud.setScore(this.score);
                this.stage.effects.confetti(new THREE.Vector3(star.plan.x, 1, star.plan.z), 25);
                audio.play('score');
            }
        }
    }

    private lostStar(id: number, wasMine: boolean): void {
        const star = this.stars.get(id);
        if (star) {
            this.stage.effects.poof(star.mesh.position.clone());
        }
        this.removeStar(id);

        if (wasMine) {
            this.score = Math.max(0, this.score - STAR_POINTS);
            this.starsCollected--;
            this.context.hud.setScore(this.score);
            this.context.hud.callout('Snatched!', 'bad');
        }
    }

    private removeStar(id: number): void {
        const star = this.stars.get(id);
        if (star) {
            this.stage.scene.remove(star.mesh);
            this.stars.delete(id);
        }
    }

    private animate(dt: number): void {
        for (const star of this.stars.values()) {
            star.mesh.rotation.y += dt * 3;
            const age = this.time - star.plan.spawnAt;
            star.mesh.position.y = 0.8 + Math.sin(age * 4) * 0.15;
            star.mesh.visible = age < STAR_LIFETIME - 1.2 || Math.floor(age * 8) % 2 === 0;
            star.mesh.scale.setScalar(Math.min(1, age * 4));
        }
    }
}

export const createMeteorMayhem: MinigameFactory = (context) => new MeteorMayhem(context);
