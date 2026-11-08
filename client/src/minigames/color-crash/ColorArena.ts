import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette } from '../../design/palette';
import type { ColliderHandle, StaticWorld } from '../../world/StaticWorld';
import { CRASH_COLORS, symbolPoints, type SymbolShape } from './colors';
import { GRID_SIZE } from './rounds';

export const TILE_SIZE = 2.3;
const TILE_GAP = 0.25;
const TILE_PITCH = TILE_SIZE + TILE_GAP;
const TILE_HEIGHT = 0.5;
const HIDDEN_Y = -9;

type TileState = 'idle' | 'warning' | 'falling' | 'hidden' | 'rising';

interface Tile {
    index: number;
    group: THREE.Group;
    body: THREE.Mesh;
    symbol: THREE.Mesh;
    collider: ColliderHandle;
    colorIndex: number;
    state: TileState;
    timer: number;
    velocity: number;
    spin: THREE.Vector3;
    home: THREE.Vector3;
    pop: number;
}

const symbolGeometries = new Map<SymbolShape, THREE.ShapeGeometry>();

function symbolGeometry(symbol: SymbolShape): THREE.ShapeGeometry {
    let geometry = symbolGeometries.get(symbol);

    if (!geometry) {
        const points = symbolPoints(symbol).map(([x, y]) => new THREE.Vector2(x * 0.62, y * 0.62));
        geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
        geometry.rotateX(-Math.PI / 2);
        symbolGeometries.set(symbol, geometry);
    }

    return geometry;
}

/** The 7x7 floating tile grid, its animations and its colliders. */
export class ColorArena {
    readonly group = new THREE.Group();
    readonly halfExtent = ((GRID_SIZE - 1) / 2) * TILE_PITCH + TILE_SIZE / 2;
    private readonly tiles: Tile[] = [];
    private readonly tileGeometry = new RoundedBoxGeometry(TILE_SIZE, TILE_HEIGHT, TILE_SIZE, 3, 0.18);

    constructor(world: StaticWorld) {
        const offset = ((GRID_SIZE - 1) / 2) * TILE_PITCH;

        for (let index = 0; index < GRID_SIZE * GRID_SIZE; index++) {
            const row = Math.floor(index / GRID_SIZE);
            const column = index % GRID_SIZE;
            const home = new THREE.Vector3(column * TILE_PITCH - offset, 0, row * TILE_PITCH - offset);

            const group = new THREE.Group();
            group.position.copy(home);

            const body = new THREE.Mesh(this.tileGeometry, toonMaterial(palette.white));
            body.position.y = -TILE_HEIGHT / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            addOutline(body);

            const symbol = new THREE.Mesh(symbolGeometry('circle'), toonMaterial(palette.white));
            symbol.position.y = 0.012;
            symbol.receiveShadow = true;

            group.add(body, symbol);
            this.group.add(group);

            const collider = world.addBox({ x: home.x, y: -TILE_HEIGHT / 2, z: home.z }, { x: TILE_SIZE, y: TILE_HEIGHT, z: TILE_SIZE });

            this.tiles.push({
                index,
                group,
                body,
                symbol,
                collider,
                colorIndex: 0,
                state: 'idle',
                timer: 0,
                velocity: 0,
                spin: new THREE.Vector3(),
                home,
                pop: 0,
            });
        }
    }

    /** Tile index under a world position, or null when over a gap or the void. */
    tileAt(x: number, z: number): number | null {
        const offset = ((GRID_SIZE - 1) / 2) * TILE_PITCH;
        const column = Math.round((x + offset) / TILE_PITCH);
        const row = Math.round((z + offset) / TILE_PITCH);

        if (column < 0 || column >= GRID_SIZE || row < 0 || row >= GRID_SIZE) {
            return null;
        }

        const tile = this.tiles[row * GRID_SIZE + column];
        const inside = Math.abs(x - tile.home.x) <= TILE_SIZE / 2 && Math.abs(z - tile.home.z) <= TILE_SIZE / 2;

        return inside && tile.collider.enabled ? tile.index : null;
    }

    colorOf(tile: number): number {
        return this.tiles[tile].colorIndex;
    }

    tilePosition(tile: number): THREE.Vector3 {
        return this.tiles[tile].home.clone();
    }

    /** Recolours every tile. Standing tiles do a little pop. */
    applyLayout(layout: readonly number[]): void {
        layout.forEach((colorIndex, index) => {
            const tile = this.tiles[index];
            const color = CRASH_COLORS[colorIndex];
            tile.colorIndex = colorIndex;
            tile.body.material = toonMaterial(color.color);
            tile.symbol.geometry = symbolGeometry(color.symbol);
            tile.pop = 1;
        });
    }

    /** Wrong tiles start to wobble. */
    warn(target: number): void {
        for (const tile of this.tiles) {
            if (tile.colorIndex !== target && tile.state === 'idle') {
                tile.state = 'warning';
            }
        }
    }

    /** Wrong tiles lose collision and fall away. */
    drop(target: number): THREE.Vector3[] {
        const dropped: THREE.Vector3[] = [];

        for (const tile of this.tiles) {
            if (tile.colorIndex === target) {
                continue;
            }

            tile.state = 'falling';
            tile.collider.enabled = false;
            tile.velocity = 0;
            tile.spin.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3);
            dropped.push(tile.home);
        }

        return dropped;
    }

    /** Fallen tiles fly back up with their new colours. */
    restore(layout: readonly number[] | null): void {
        if (layout) {
            this.applyLayout(layout);
        }

        for (const tile of this.tiles) {
            if (tile.state === 'falling' || tile.state === 'hidden') {
                tile.state = 'rising';
                tile.timer = 0;
                tile.group.position.set(tile.home.x, HIDDEN_Y, tile.home.z);
                tile.group.rotation.set(0, 0, 0);
            }
        }
    }

    update(dt: number, time: number): void {
        for (const tile of this.tiles) {
            this.updateTile(tile, dt, time);
        }
    }

    private updateTile(tile: Tile, dt: number, time: number): void {
        const { group, home } = tile;

        tile.pop = Math.max(0, tile.pop - dt * 4);
        const popScale = 1 + Math.sin(tile.pop * Math.PI) * 0.08;
        tile.symbol.scale.setScalar(popScale);

        switch (tile.state) {
            case 'idle':
                group.position.copy(home);
                group.position.y = Math.sin(time * 1.4 + tile.index * 0.7) * 0.03;
                break;

            case 'warning': {
                const shake = 0.06;
                group.position.set(
                    home.x + (Math.random() - 0.5) * shake,
                    home.y - 0.08 + (Math.random() - 0.5) * shake,
                    home.z + (Math.random() - 0.5) * shake,
                );
                group.rotation.z = (Math.random() - 0.5) * 0.05;
                break;
            }

            case 'falling':
                tile.velocity += 28 * dt;
                group.position.y -= tile.velocity * dt;
                group.rotation.x += tile.spin.x * dt;
                group.rotation.y += tile.spin.y * dt;
                group.rotation.z += tile.spin.z * dt;
                if (group.position.y < HIDDEN_Y) {
                    tile.state = 'hidden';
                }
                break;

            case 'hidden':
                break;

            case 'rising': {
                tile.timer += dt;
                const t = Math.min(1, tile.timer / 0.55);
                // Ease out with a small overshoot so tiles "land" into place.
                const eased = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
                group.position.set(home.x, HIDDEN_Y + (home.y - HIDDEN_Y) * eased, home.z);
                group.rotation.set(0, 0, 0);
                if (t >= 1) {
                    tile.state = 'idle';
                    tile.collider.enabled = true;
                }
                break;
            }
        }
    }
}
