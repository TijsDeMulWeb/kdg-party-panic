import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { addOutline, createToonMaterial, toonMaterial } from '../../design/materials';
import { palette } from '../../design/palette';
import { ClaimBook } from '../../multiplayer/ClaimBook';
import { StaticWorld } from '../../world/StaticWorld';
import { createTree } from '../../world/props';
import { MinigameStage } from '../shared/MinigameStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { CATCH_RADIUS, FALL_TIME, FRUIT_POINTS, HALF_SIZE, planFruit, type FruitKind, type FruitPlan } from './rules';

const DROP_HEIGHT = 11;
const SPLAT_TIME = 1.2;

interface LiveFruit {
    plan: FruitPlan;
    mesh: THREE.Group;
    marker: THREE.Mesh;
    landed: boolean;
    splatTime: number;
}

const markerGeometry = new THREE.RingGeometry(0.75, 1.0, 28);

function createFruit(kind: FruitKind): THREE.Group {
    const group = new THREE.Group();
    const colors: Record<FruitKind, number> = { apple: palette.coral, pear: 0x9fd94a, golden: palette.sun, rotten: 0x7a6a4a };
    const body = new THREE.Mesh(new THREE.SphereGeometry(kind === 'golden' ? 0.4 : 0.34, 16, 12), toonMaterial(colors[kind]));
    body.scale.y = kind === 'pear' ? 1.3 : 1;
    addOutline(body).scale.setScalar(1.08);
    body.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), toonMaterial(palette.dirtDark));
    stem.position.y = kind === 'pear' ? 0.5 : 0.38;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toonMaterial(kind === 'rotten' ? 0x5a4a2a : palette.grassDark));
    leaf.scale.set(1.4, 0.4, 0.8);
    leaf.position.set(0.1, stem.position.y + 0.02, 0);
    group.add(body, stem, leaf);

    if (kind === 'rotten') {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toonMaterial(0x3e3326));
        spot.position.set(0.2, 0.1, 0.22);
        group.add(spot);
    }

    return group;
}

/** A basket worn on the head: fruit lands in it. */
function createBasket(): THREE.Group {
    const basket = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.4, 0.38, 16, 1, true), toonMaterial(0xc98a5a));
    bowl.material.side = THREE.DoubleSide;
    addOutline(bowl).scale.setScalar(1.04);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 20), toonMaterial(palette.dirtDark));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.19;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), toonMaterial(palette.dirtDark));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.18;
    basket.add(bowl, rim, floor);
    basket.position.y = 1.4;

    return basket;
}

/** Fruit Frenzy: catch falling fruit in your head basket, avoid the rotten ones. */
class FruitFrenzy implements Minigame {
    private readonly world = new StaticWorld();
    private readonly stage: MinigameStage;
    private readonly plans: FruitPlan[];
    private readonly fruit: LiveFruit[] = [];
    private readonly claims: ClaimBook;
    private readonly basket: THREE.Group;
    private next = 0;
    private time = 0;
    private score = 0;
    private caught = 0;
    private rottenCaught = 0;
    private streak = 0;
    private basketBounce = 0;

    constructor(private readonly context: MinigameContext) {
        this.plans = planFruit(context.seed);

        const seats = [
            [-2, 2],
            [2, 2],
            [-2, -2],
            [2, -2],
        ];
        this.stage = new MinigameStage(context, {
            world: this.world,
            spawn: (seat) => new THREE.Vector3(context.network ? seats[seat % 4][0] : 0, 0, context.network ? seats[seat % 4][1] : 1),
            framing: { distance: 10, height: 14, portraitDistance: 15, portraitHeight: 22 },
        });

        this.basket = createBasket();
        this.stage.player.model.root.add(this.basket);
        this.buildOrchard();
        this.claims = new ClaimBook(context.network, () => this.time, (id, wasMine) => this.lost(id, wasMine));
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

        this.stage.movePlayer(dt, input, playing);

        if (playing) {
            this.spawn();
            this.updateFruit(dt);
        }

        this.basketBounce = Math.max(0, this.basketBounce - dt * 4);
        this.basket.scale.setScalar(1 + Math.sin(this.basketBounce * Math.PI) * 0.25);

        this.stage.updateShared(dt, this.score, false, () => this.claims.payload());
        const feet = this.stage.position;
        this.stage.follow(new THREE.Vector3(feet.x * 0.35, 0, feet.z * 0.3 + 1), dt);
    }

    isOver(): boolean {
        return false;
    }

    getResult(): MinigameResult {
        return {
            score: this.score,
            title: this.rottenCaught === 0 ? 'Fresh picks only!' : 'Fruit salad!',
            stats: [
                { label: 'Fruit caught', value: String(this.caught) },
                { label: 'Rotten apples', value: String(this.rottenCaught) },
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
        while (this.next < this.plans.length && this.plans[this.next].landsAt - FALL_TIME <= this.time) {
            const plan = this.plans[this.next++];

            if (this.claims.isClaimed(plan.id)) {
                continue;
            }

            const mesh = createFruit(plan.kind);
            const marker = new THREE.Mesh(markerGeometry, createToonMaterial(plan.kind === 'rotten' ? 0x7a6a4a : palette.white, { transparent: true, opacity: 0.6, depthWrite: false }));
            marker.rotation.x = -Math.PI / 2;
            marker.position.set(plan.x, 0.03, plan.z);
            this.stage.scene.add(mesh, marker);
            this.fruit.push({ plan, mesh, marker, landed: false, splatTime: 0 });
        }
    }

    private updateFruit(dt: number): void {
        const feet = this.stage.player.state.position;

        for (let index = this.fruit.length - 1; index >= 0; index--) {
            const item = this.fruit[index];
            const untilLanding = item.plan.landsAt - this.time;

            if (!item.landed) {
                const progress = 1 - Math.max(0, untilLanding) / FALL_TIME;
                item.mesh.position.set(item.plan.x, DROP_HEIGHT * (1 - progress * progress) + 1.4 * progress * progress, item.plan.z);
                item.mesh.rotation.y += 0.08;
                item.marker.scale.setScalar(1.4 - progress * 0.6);

                if (untilLanding <= 0) {
                    item.landed = true;
                    const inBasket = Math.hypot(feet.x - item.plan.x, feet.z - item.plan.z) < CATCH_RADIUS && feet.y < 2;

                    if (inBasket && this.claims.claim(item.plan.id)) {
                        this.catchFruit(item);
                        this.remove(index);
                        continue;
                    }

                    this.splat(item);
                }
            }

            if (item.landed) {
                item.splatTime += dt;
                if (item.splatTime > SPLAT_TIME) {
                    this.remove(index);
                }
            }
        }
    }

    private catchFruit(item: LiveFruit): void {
        const points = FRUIT_POINTS[item.plan.kind];
        this.score = Math.max(0, this.score + points);
        this.basketBounce = 1;
        this.context.hud.setScore(this.score);

        if (item.plan.kind === 'rotten') {
            this.rottenCaught++;
            this.streak = 0;
            this.context.hud.callout(`Yuck! ${points}`, 'bad');
            this.stage.effects.poof(item.mesh.position.clone());
            audio.play('wrong');
            return;
        }

        this.caught++;
        this.streak++;
        this.stage.effects.confetti(item.mesh.position.clone(), item.plan.kind === 'golden' ? 40 : 12);
        audio.play(item.plan.kind === 'golden' ? 'bonus' : 'collect');

        if (item.plan.kind === 'golden' || this.streak % 5 === 0) {
            this.context.hud.callout(item.plan.kind === 'golden' ? `Golden! +${points}` : `${this.streak} in a row!`, 'good');
        }
    }

    private splat(item: LiveFruit): void {
        item.mesh.position.y = 0.15;
        item.mesh.scale.set(1.5, 0.3, 1.5);
        item.marker.visible = false;
        this.stage.effects.landing(item.mesh.position.clone(), 6);
    }

    private remove(index: number): void {
        const item = this.fruit[index];
        this.stage.scene.remove(item.mesh, item.marker);
        (item.marker.material as THREE.Material).dispose();
        this.fruit.splice(index, 1);
    }

    /** Someone else caught it: it disappears here, and if we thought we had it, we lose the points. */
    private lost(id: number, wasMine: boolean): void {
        const index = this.fruit.findIndex((item) => item.plan.id === id);
        if (index !== -1) {
            this.remove(index);
        }

        if (wasMine) {
            const plan = this.plans[id];
            this.score = Math.max(0, this.score - FRUIT_POINTS[plan.kind]);
            if (plan.kind !== 'rotten') {
                this.caught--;
            }
            this.context.hud.setScore(this.score);
            this.context.hud.callout('Snatched!', 'bad');
        }
    }

    private buildOrchard(): void {
        const scene = this.stage.scene;
        const size = HALF_SIZE * 2 + 2;
        const ground = new THREE.Mesh(new THREE.BoxGeometry(size + 6, 1, size + 6), toonMaterial(palette.grass));
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        scene.add(ground);
        this.world.addBox({ x: 0, y: -0.5, z: 0 }, { x: size + 6, y: 1, z: size + 6 });

        const fenceMaterial = toonMaterial(palette.white);
        const edge = HALF_SIZE + 0.6;
        for (const [x, z, w, d] of [
            [0, -edge, size, 0.3],
            [0, edge, size, 0.3],
            [-edge, 0, 0.3, size],
            [edge, 0, 0.3, size],
        ]) {
            const fence = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), fenceMaterial);
            fence.position.set(x, 0.4, z);
            fence.castShadow = true;
            addOutline(fence);
            scene.add(fence);
            this.world.addBox({ x, y: 1, z }, { x: w, y: 2.4, z: d }, { walkable: false });
        }

        for (let index = 0; index < 14; index++) {
            const angle = (index / 14) * Math.PI * 2;
            const tree = createTree(3.6 + (index % 3) * 0.5);
            tree.position.set(Math.cos(angle) * (HALF_SIZE + 3), 0, Math.sin(angle) * (HALF_SIZE + 3));
            scene.add(tree);
        }
    }
}

export const createFruitFrenzy: MinigameFactory = (context) => new FruitFrenzy(context);
