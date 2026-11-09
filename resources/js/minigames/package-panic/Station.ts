import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addOutline, createToonMaterial, toonMaterial } from '../../design/materials';
import { palette } from '../../design/palette';
import { SYMBOL_COLORS, symbolGeometry } from '../../design/symbols';
import type { StaticWorld } from '../../world/StaticWorld';
import { BELT_LENGTH, LANE_COUNT, LANE_WIDTH, laneCenter } from './rules';

const BELT_WIDTH = LANE_COUNT * LANE_WIDTH;
export const BELT_HALF_WIDTH = BELT_WIDTH / 2;

/** Animated stripes so the belt visibly moves. */
function beltTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    if (context) {
        context.fillStyle = '#3b3550';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = '#4c4566';
        context.fillRect(0, 0, 64, 18);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, BELT_LENGTH);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

/**
 * One player's sorting station: a conveyor belt that ends over three
 * coloured bins. `origin` is the centre of the belt's drop edge.
 */
export class Station {
    readonly group = new THREE.Group();
    private readonly beltMaterial: THREE.MeshToonMaterial;
    private readonly binSigns: THREE.Mesh[] = [];
    private readonly binSymbols: THREE.Mesh[] = [];
    private readonly binBodies: THREE.Mesh[] = [];
    private readonly rollers: THREE.Mesh[] = [];

    constructor(readonly originX: number, accent: number, world?: StaticWorld) {
        this.group.position.x = originX;
        this.beltMaterial = createToonMaterial(0xffffff, { map: beltTexture() });

        const belt = new THREE.Mesh(new THREE.BoxGeometry(BELT_WIDTH, 0.3, BELT_LENGTH), this.beltMaterial);
        belt.position.set(0, -0.15, -BELT_LENGTH / 2);
        belt.receiveShadow = true;
        this.group.add(belt);

        const frameMaterial = toonMaterial(accent);
        for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.7, BELT_LENGTH + 0.4, 2, 0.12), frameMaterial);
            rail.position.set(side * (BELT_HALF_WIDTH + 0.2), 0.05, -BELT_LENGTH / 2);
            rail.castShadow = true;
            addOutline(rail);
            this.group.add(rail);
        }

        for (let index = 0; index < 6; index++) {
            const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, BELT_WIDTH + 0.1, 12), toonMaterial(palette.rock));
            roller.rotation.z = Math.PI / 2;
            roller.position.set(0, -0.35, -0.3 - index * (BELT_LENGTH / 5.4));
            this.rollers.push(roller);
            this.group.add(roller);
        }

        const legMaterial = toonMaterial(palette.ink);
        for (const z of [-1, -BELT_LENGTH + 1]) {
            for (const side of [-1, 1]) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), legMaterial);
                leg.position.set(side * BELT_HALF_WIDTH, -1.8, z);
                this.group.add(leg);
            }
        }

        this.buildBins();
        this.buildHopper(accent);

        if (world) {
            this.addColliders(world);
        }
    }

    /** Scrolls the belt texture and spins the rollers at the belt's speed. */
    update(dt: number, speed: number): void {
        const map = this.beltMaterial.map;
        if (map) {
            map.offset.y += (speed * dt) / 1;
        }

        for (const roller of this.rollers) {
            roller.rotation.x -= (speed * dt) / 0.22;
        }
    }

    setBinColors(lanes: readonly number[]): void {
        lanes.forEach((colorIndex, lane) => {
            const color = SYMBOL_COLORS[colorIndex];
            this.binBodies[lane].material = toonMaterial(color.color);
            this.binSigns[lane].material = toonMaterial(color.color);
            this.binSymbols[lane].geometry = symbolGeometry(color.symbol, 0.45);
            this.binSigns[lane].scale.setScalar(1.25);
        });
    }

    /** Little bounce on the signs, e.g. after a shuffle. */
    animate(dt: number): void {
        for (const sign of this.binSigns) {
            sign.scale.setScalar(Math.max(1, sign.scale.x - dt * 1.5));
        }
    }

    binPosition(lane: number): THREE.Vector3 {
        return new THREE.Vector3(this.originX + laneCenter(lane), -1.4, 1.2);
    }

    dispose(): void {
        this.beltMaterial.map?.dispose();
        this.beltMaterial.dispose();
    }

    private buildBins(): void {
        for (let lane = 0; lane < LANE_COUNT; lane++) {
            const x = laneCenter(lane);
            const body = new THREE.Mesh(new RoundedBoxGeometry(LANE_WIDTH - 0.15, 1.6, 2, 2, 0.15), toonMaterial(palette.white));
            body.position.set(x, -2.2, 1.2);
            body.castShadow = true;
            body.receiveShadow = true;
            addOutline(body);

            const opening = new THREE.Mesh(new THREE.BoxGeometry(LANE_WIDTH - 0.5, 0.05, 1.6), toonMaterial(palette.ink));
            opening.position.set(x, -1.39, 1.2);

            const sign = new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.2, 0.2, 2, 0.1), toonMaterial(palette.white));
            sign.position.set(x, -2.3, 2.25);
            addOutline(sign);
            const symbol = new THREE.Mesh(symbolGeometry('circle', 0.45), toonMaterial(palette.white));
            symbol.rotation.x = Math.PI / 2;
            symbol.position.z = 0.11;
            sign.add(symbol);

            this.binBodies.push(body);
            this.binSigns.push(sign);
            this.binSymbols.push(symbol);
            this.group.add(body, opening, sign);
        }
    }

    /** The chute packages drop out of, at the far end of the belt. */
    private buildHopper(accent: number): void {
        const hopper = new THREE.Mesh(new RoundedBoxGeometry(BELT_WIDTH + 0.8, 1.6, 1.4, 2, 0.2), toonMaterial(accent));
        hopper.position.set(0, 2.6, -BELT_LENGTH - 0.2);
        addOutline(hopper);
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(BELT_WIDTH - 0.4, 0.9, 0.1), toonMaterial(palette.ink));
        mouth.position.set(0, 2.5, -BELT_LENGTH + 0.52);
        this.group.add(hopper, mouth);
    }

    private addColliders(world: StaticWorld): void {
        const x = this.originX;
        world.addBox({ x, y: -0.15, z: -BELT_LENGTH / 2 }, { x: BELT_WIDTH, y: 0.3, z: BELT_LENGTH });

        for (const side of [-1, 1]) {
            world.addBox({ x: x + side * (BELT_HALF_WIDTH + 0.2), y: 1, z: -BELT_LENGTH / 2 }, { x: 0.4, y: 2.6, z: BELT_LENGTH + 0.4 }, { walkable: false });
        }

        // Invisible railing at the drop edge so the player cannot fall into the bins.
        world.addBox({ x, y: 1.2, z: 0.25 }, { x: BELT_WIDTH, y: 3, z: 0.3 }, { walkable: false });
        world.addBox({ x, y: 1.2, z: -BELT_LENGTH - 0.25 }, { x: BELT_WIDTH, y: 3, z: 0.3 }, { walkable: false });
    }
}
