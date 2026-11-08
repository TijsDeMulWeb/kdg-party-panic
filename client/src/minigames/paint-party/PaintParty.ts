import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette } from '../../design/palette';
import { StaticWorld } from '../../world/StaticWorld';
import { MinigameStage } from '../shared/MinigameStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { GRID, HALF, planRollers, POINTS_PER_TILE, rollerAt, TILE, tileAt, tileCenter, type RollerPlan } from './rules';

interface TileState {
    owner: number | null;
    /** Time (ms, server-synchronised) of the last change; later changes win. */
    time: number;
}

const BROADCAST_MS = 1500;
const BLANK = 0xf4efe6;
const tileGeometry = new RoundedBoxGeometry(TILE - 0.08, 0.3, TILE - 0.08, 2, 0.06);

/**
 * Paint Party: run over tiles to paint them your colour. Rollers wipe
 * paint off. Whoever owns the most tiles at the end wins.
 */
class PaintParty implements Minigame {
    private readonly world = new StaticWorld();
    private readonly stage: MinigameStage;
    private readonly tiles: TileState[] = Array.from({ length: GRID * GRID }, () => ({ owner: null, time: 0 }));
    private readonly tileMeshes: THREE.Mesh[] = [];
    private readonly rollers: RollerPlan[];
    private readonly rollerMeshes: THREE.Group[] = [];
    private readonly colors = new Map<number, number>();
    private readonly recentPaints: { tile: number; time: number }[] = [];
    private readonly unsubscribe: (() => void) | null = null;
    private readonly myId: number;
    private time = 0;
    private hitCooldown = 0;
    private bestCount = 0;

    constructor(private readonly context: MinigameContext) {
        this.rollers = planRollers(context.seed);
        this.myId = context.network?.localPlayerId ?? 0;
        this.colors.set(this.myId, context.character.body);
        context.network?.remotePlayers.forEach((player) => this.colors.set(player.id, player.character.body));

        const corners = [
            [-HALF + 2, -HALF + 2],
            [HALF - 2, HALF - 2],
            [HALF - 2, -HALF + 2],
            [-HALF + 2, HALF - 2],
        ];
        this.stage = new MinigameStage(context, {
            world: this.world,
            spawn: (seat) => (context.network ? new THREE.Vector3(corners[seat % 4][0], 0, corners[seat % 4][1]) : new THREE.Vector3(0, 0, 2)),
            framing: { distance: 11, height: 17, portraitDistance: 18, portraitHeight: 28 },
            shadowSize: 15,
        });
        this.buildArena(this.stage.scene);

        for (const plan of this.rollers) {
            const mesh = this.createRoller(plan.horizontal);
            mesh.visible = false;
            this.stage.scene.add(mesh);
            this.rollerMeshes.push(mesh);
        }

        if (context.network) {
            this.unsubscribe = context.network.onSnapshot((playerId, snapshot) => this.receivePaints(playerId, snapshot.e));
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
        return this.countOwned(this.myId) * POINTS_PER_TILE;
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        const playing = elapsed !== null;
        if (playing) {
            this.time = elapsed;
        }

        this.stage.movePlayer(dt, input, playing);

        if (playing) {
            this.paintUnderPlayer();
            this.updateRollers(dt);
        }

        this.bestCount = Math.max(this.bestCount, this.countOwned(this.myId));
        this.stage.updateShared(dt, this.getScore(), false, () => this.paintPayload());

        const feet = this.stage.position;
        this.stage.follow(new THREE.Vector3(feet.x * 0.3, 0, feet.z * 0.3 + 1), dt);
    }

    isOver(): boolean {
        return false;
    }

    getResult(): MinigameResult {
        const owned = this.countOwned(this.myId);

        return {
            score: owned * POINTS_PER_TILE,
            title: owned >= GRID * GRID * 0.4 ? 'Masterpiece!' : 'Splashy!',
            stats: [
                { label: 'Tiles painted at the end', value: `${owned} / ${GRID * GRID}` },
                { label: 'Most tiles at once', value: String(this.bestCount) },
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

    private paintUnderPlayer(): void {
        const { position, grounded } = this.stage.player.state;

        if (!grounded) {
            return;
        }

        const tile = tileAt(position.x, position.z);

        if (tile === null || this.tiles[tile].owner === this.myId) {
            return;
        }

        const time = this.now();
        this.setTile(tile, this.myId, time);
        this.recentPaints.push({ tile, time });

        const center = tileCenter(tile);
        this.stage.effects.dash(new THREE.Vector3(center.x, 0.2, center.z), this.context.character.body);
        audio.play('collect', 0.35);
    }

    private setTile(tile: number, owner: number | null, time: number): void {
        const state = this.tiles[tile];

        if (time < state.time) {
            return;
        }

        state.owner = owner;
        state.time = time;
        this.tileMeshes[tile].material = toonMaterial(owner === null ? BLANK : (this.colors.get(owner) ?? BLANK));
        this.tileMeshes[tile].scale.y = 1.6;
    }

    private countOwned(owner: number): number {
        return this.tiles.filter((tile) => tile.owner === owner).length;
    }

    private paintPayload(): number[] {
        const now = this.now();

        while (this.recentPaints.length && now - this.recentPaints[0].time > BROADCAST_MS) {
            this.recentPaints.shift();
        }

        return this.recentPaints.slice(-40).flatMap((paint) => [paint.tile, paint.time]);
    }

    private receivePaints(playerId: number, payload: number[] | undefined): void {
        if (!payload) {
            return;
        }

        for (let index = 0; index + 1 < payload.length; index += 2) {
            const tile = payload[index];
            const time = payload[index + 1];

            if (tile >= 0 && tile < this.tiles.length && time > this.tiles[tile].time) {
                this.setTile(tile, playerId, time);
            }
        }
    }

    /** Rollers wipe the tiles they cross and bowl over anyone in the way. */
    private updateRollers(dt: number): void {
        this.hitCooldown -= dt;

        this.rollers.forEach((plan, index) => {
            const position = rollerAt(plan, this.time);
            const mesh = this.rollerMeshes[index];

            if (!position) {
                return;
            }

            mesh.visible = true;
            mesh.position.set(position.x, 0, position.z);
            mesh.children[0].rotateY(dt * 6 * position.direction);

            for (const offset of [-0.6, 0, 0.6]) {
                const tile = tileAt(position.x + (plan.horizontal ? 0 : offset), position.z + (plan.horizontal ? offset : 0));
                if (tile !== null && this.tiles[tile].owner !== null) {
                    this.setTile(tile, null, this.now());
                }
            }

            const player = this.stage.player;
            const feet = player.state.position;
            const dx = feet.x - position.x;
            const dz = feet.z - position.z;
            const hit = plan.horizontal ? Math.abs(dx) < 0.9 && Math.abs(dz) < TILE / 2 + 0.3 : Math.abs(dz) < 0.9 && Math.abs(dx) < TILE / 2 + 0.3;

            if (hit && feet.y < 0.9 && this.hitCooldown <= 0) {
                this.hitCooldown = 0.8;
                const pushX = plan.horizontal ? position.direction * 9 : Math.sign(dx || 1) * 6;
                const pushZ = plan.horizontal ? Math.sign(dz || 1) * 6 : position.direction * 9;
                player.knockback(pushX, pushZ, 6);
                this.stage.rig.shake(0.4);
                audio.play('bump', 1.3);
            }
        });

        for (const mesh of this.tileMeshes) {
            mesh.scale.y = Math.max(1, mesh.scale.y - dt * 4);
        }
    }

    private buildArena(scene: THREE.Scene): void {
        const base = new THREE.Mesh(new RoundedBoxGeometry(GRID * TILE + 1.4, 1.2, GRID * TILE + 1.4, 3, 0.3), toonMaterial(palette.grape));
        base.position.y = -0.75;
        base.receiveShadow = true;
        addOutline(base);
        scene.add(base);
        this.world.addBox({ x: 0, y: -0.5, z: 0 }, { x: GRID * TILE + 1.4, y: 1, z: GRID * TILE + 1.4 });

        for (let index = 0; index < GRID * GRID; index++) {
            const tile = new THREE.Mesh(tileGeometry, toonMaterial(BLANK));
            const { x, z } = tileCenter(index);
            tile.position.set(x, -0.15, z);
            tile.receiveShadow = true;
            this.tileMeshes.push(tile);
            scene.add(tile);
        }

        const rim = HALF + 0.7;
        for (const [x, z, w, d] of [
            [0, -rim - 0.2, GRID * TILE + 2, 0.4],
            [0, rim + 0.2, GRID * TILE + 2, 0.4],
            [-rim - 0.2, 0, 0.4, GRID * TILE + 2],
            [rim + 0.2, 0, 0.4, GRID * TILE + 2],
        ]) {
            this.world.addBox({ x, y: 1, z }, { x: w, y: 2.4, z: d }, { walkable: false });
        }

    }

    private createRoller(horizontal: boolean): THREE.Group {
        const group = new THREE.Group();
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, TILE * 1.6, 16), toonMaterial(palette.white));
        drum.rotation.z = Math.PI / 2;
        drum.position.y = 0.55;
        addOutline(drum);
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.3, 16), toonMaterial(palette.coral));
        drum.add(stripe);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15), toonMaterial(palette.ink));
        handle.position.set(0, 1.3, 0);
        group.add(drum, handle);
        group.rotation.y = horizontal ? Math.PI / 2 : 0;
        group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
            }
        });

        return group;
    }
}

export const createPaintParty: MinigameFactory = (context) => new PaintParty(context);
