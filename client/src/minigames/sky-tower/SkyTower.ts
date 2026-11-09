import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { addOutline, createToonMaterial, toonMaterial } from '../../design/materials';
import { palette, partyColors } from '../../design/palette';
import { ClaimBook } from '../../multiplayer/ClaimBook';
import { StaticWorld } from '../../world/StaticWorld';
import { createIsland } from '../../world/props';
import { MinigameStage } from '../shared/MinigameStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { BASE_RADIUS, gooHeight, PILLAR_RADIUS, planTower, scoreFor, type PlatformPlan } from './rules';

/** Sky Tower: jump up the spiral before the goo catches you. */
class SkyTower implements Minigame {
    private readonly world = new StaticWorld();
    private readonly stage: MinigameStage;
    private readonly platforms: PlatformPlan[];
    private readonly stars = new Map<number, THREE.Mesh>();
    private readonly goo: THREE.Mesh;
    private readonly claims: ClaimBook;
    private time = 0;
    private maxHeight = 0;
    private starsCollected = 0;
    private eliminated = false;
    private nextMilestone = 10;
    private readonly focus = new THREE.Vector3();

    constructor(private readonly context: MinigameContext) {
        this.platforms = planTower(context.seed);

        this.stage = new MinigameStage(context, {
            world: this.world,
            spawn: (seat) => {
                const angle = context.network ? seat * (Math.PI / 2) : this.platforms[0].angle - 0.6;
                return new THREE.Vector3(Math.sin(angle) * 4.5, 0, Math.cos(angle) * 4.5);
            },
            framing: { distance: 12, height: 7.5, portraitDistance: 16, portraitHeight: 10 },
            shadowSize: 12,
        });
        this.stage.rig.options.lookHeight = 2.2;

        this.buildTower();
        this.goo = this.createGoo();
        this.claims = new ClaimBook(context.network, () => this.time, (id) => this.removeStar(id));

        this.focus.copy(this.stage.position);
        this.updateCamera(0, true);
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
        return scoreFor(this.maxHeight, this.starsCollected);
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        const playing = elapsed !== null;
        if (playing) {
            this.time = elapsed;
        }

        const goo = gooHeight(this.time);
        this.goo.position.y = goo - 30;
        this.goo.rotation.y += dt * 0.2;

        if (!this.eliminated) {
            this.stage.movePlayer(dt, input, playing);
            const { position, grounded } = this.stage.player.state;

            if (grounded && position.y > this.maxHeight) {
                this.maxHeight = position.y;
                if (this.maxHeight >= this.nextMilestone) {
                    this.context.hud.callout(`${this.nextMilestone} m!`, 'good');
                    audio.play('bonus');
                    this.nextMilestone += 10;
                }
            }

            this.collectStars();

            if (playing && position.y < goo - 0.2) {
                this.eliminate();
            }
        }

        for (const star of this.stars.values()) {
            star.rotation.y += dt * 2.5;
        }

        if (Math.random() < dt * 6) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 3 + Math.random() * 8;
            this.stage.effects.landing(new THREE.Vector3(Math.cos(angle) * radius, goo, Math.sin(angle) * radius), 4);
        }

        this.stage.updateShared(dt, this.getScore(), this.eliminated);
        this.updateCamera(dt, false);
    }

    isOver(): boolean {
        return this.eliminated;
    }

    getResult(): MinigameResult {
        return {
            score: this.getScore(),
            title: this.eliminated ? 'Gooed!' : 'Sky high!',
            stats: [
                { label: 'Highest point', value: `${this.maxHeight.toFixed(1)} m` },
                { label: 'Stars', value: String(this.starsCollected) },
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

    /** The camera circles the tower to stay behind the player, looking in at the pillar. */
    private updateCamera(dt: number, snap: boolean): void {
        const feet = this.stage.position;
        const yaw = Math.atan2(feet.x, feet.z);
        this.focus.set(feet.x * 0.6, Math.max(feet.y, gooHeight(this.time) + 1), feet.z * 0.6);

        if (snap) {
            this.stage.rig.turnTowards(yaw, 1, 1000);
        } else {
            this.stage.rig.turnTowards(yaw, dt, 3);
        }

        this.stage.follow(this.focus, dt, snap);
    }

    private collectStars(): void {
        const feet = this.stage.player.state.position;

        for (const [id, star] of this.stars) {
            if (Math.hypot(feet.x - star.position.x, feet.y + 0.6 - star.position.y, feet.z - star.position.z) < 1.2 && this.claims.claim(id)) {
                this.removeStar(id);
                this.starsCollected++;
                this.context.hud.setScore(this.getScore());
                this.stage.effects.confetti(star.position.clone(), 20);
                audio.play('score');
            }
        }
    }

    private removeStar(id: number): void {
        const star = this.stars.get(id);
        if (star) {
            this.stage.scene.remove(star);
            this.stars.delete(id);
        }
    }

    private eliminate(): void {
        this.eliminated = true;
        this.context.hud.callout('Gooed!', 'bad');
        this.stage.effects.poof(this.stage.position.clone());
        this.stage.player.model.root.visible = false;
        audio.play('out');
    }

    private buildTower(): void {
        const scene = this.stage.scene;
        const base = createIsland(BASE_RADIUS, 1.2);
        scene.add(base);
        this.world.addCylinder(0, -2, 0, BASE_RADIUS, 2);

        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(PILLAR_RADIUS, PILLAR_RADIUS * 1.15, 70, 24), toonMaterial(palette.white));
        pillar.position.y = 35;
        addOutline(pillar);
        scene.add(pillar);
        this.world.addCylinder(0, -1, 0, PILLAR_RADIUS, 72, { walkable: false });

        for (let ring = 0; ring < 30; ring++) {
            const stripe = new THREE.Mesh(new THREE.TorusGeometry(PILLAR_RADIUS + 0.02, 0.12, 6, 28), toonMaterial(partyColors[ring % partyColors.length]));
            stripe.rotation.x = Math.PI / 2;
            stripe.position.y = ring * 2.2 + 1;
            scene.add(stripe);
        }

        const starGeometry = new THREE.OctahedronGeometry(0.35, 0);

        for (const platform of this.platforms) {
            const color = partyColors[platform.id % partyColors.length];
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(platform.radius, platform.radius * 0.85, 0.4, 24), toonMaterial(color));
            disc.position.set(platform.x, platform.y - 0.2, platform.z);
            disc.castShadow = true;
            disc.receiveShadow = true;
            addOutline(disc);
            scene.add(disc);

            const arm = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.25, Math.hypot(platform.x, platform.z) - PILLAR_RADIUS, 1, 0.08), toonMaterial(palette.ink));
            arm.position.set(platform.x / 2, platform.y - 0.5, platform.z / 2);
            arm.lookAt(0, platform.y - 0.5, 0);
            scene.add(arm);

            this.world.addCylinder(platform.x, platform.y - 0.4, platform.z, platform.radius, 0.4);

            if (platform.hasStar) {
                const star = new THREE.Mesh(starGeometry, toonMaterial(palette.sun));
                addOutline(star).scale.setScalar(1.12);
                star.position.set(platform.x, platform.y + 0.8, platform.z);
                scene.add(star);
                this.stars.set(platform.id, star);
            }
        }
    }

    private createGoo(): THREE.Mesh {
        const goo = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 60, 48), createToonMaterial(palette.bubblegum, { transparent: true, opacity: 0.82 }));
        this.stage.scene.add(goo);
        return goo;
    }
}

export const createSkyTower: MinigameFactory = (context) => new SkyTower(context);
