import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addOutline, createToonMaterial, toonMaterial } from '../../design/materials';
import { palette, partyColors } from '../../design/palette';
import type { StaticWorld } from '../../world/StaticWorld';
import { COURSE_LENGTH, HALF_WIDTH, type Obstacle } from './rules';

/** Start area behind the line and run-out after the finish. */
export const START_Z = 6;
export const END_Z = -COURSE_LENGTH - 8;

function checkerTexture(columns: number, rows: number, a: string, b: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = columns * 16;
    canvas.height = rows * 16;
    const context = canvas.getContext('2d');

    if (context) {
        for (let x = 0; x < columns; x++) {
            for (let y = 0; y < rows; y++) {
                context.fillStyle = (x + y) % 2 === 0 ? a : b;
                context.fillRect(x * 16, y * 16, 16, 16);
            }
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

/** Builds the obstacle course meshes and registers its colliders. */
export function buildCourse(scene: THREE.Scene, world: StaticWorld, obstacles: readonly Obstacle[]): void {
    const length = START_Z - END_Z;
    const centerZ = (START_Z + END_Z) / 2;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, 1, length), toonMaterial(palette.grass));
    floor.position.set(0, -0.5, centerZ);
    floor.receiveShadow = true;
    scene.add(floor);
    world.addBox({ x: 0, y: -0.5, z: centerZ }, { x: HALF_WIDTH * 2, y: 1, z: length });

    // Lighter stripes every 8 m make speed readable.
    for (let z = 0; z > END_Z; z -= 8) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 4), toonMaterial(palette.grassDark));
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.01, z - 2);
        stripe.receiveShadow = true;
        scene.add(stripe);
    }

    const underside = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2 - 0.4, 2, length - 0.4), toonMaterial(palette.dirt));
    underside.position.set(0, -2, centerZ);
    scene.add(underside);

    const railMaterial = toonMaterial(palette.white);
    for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new RoundedBoxGeometry(0.6, 1.2, length, 2, 0.2), railMaterial);
        rail.position.set(side * (HALF_WIDTH + 0.3), 0.6, centerZ);
        rail.castShadow = true;
        addOutline(rail);
        scene.add(rail);
        world.addBox({ x: side * (HALF_WIDTH + 0.3), y: 1, z: centerZ }, { x: 0.6, y: 2.4, z: length }, { walkable: false });

        for (let z = START_Z - 2; z > END_Z; z -= 6) {
            const flag = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 4), toonMaterial(partyColors[Math.abs(Math.round(z)) % partyColors.length]));
            flag.position.set(side * (HALF_WIDTH + 0.3), 1.6, z);
            scene.add(flag);
        }
    }

    for (const z of [START_Z, END_Z]) {
        world.addBox({ x: 0, y: 1, z: z + (z === START_Z ? 0.3 : -0.3) }, { x: HALF_WIDTH * 2, y: 2.4, z: 0.6 }, { walkable: false });
        const end = new THREE.Mesh(new RoundedBoxGeometry(HALF_WIDTH * 2 + 1.2, 1.2, 0.6, 2, 0.2), railMaterial);
        end.position.set(0, 0.6, z + (z === START_Z ? 0.3 : -0.3));
        addOutline(end);
        scene.add(end);
    }

    buildLine(scene, 0, 'start');
    buildLine(scene, -COURSE_LENGTH, 'finish');

    for (const obstacle of obstacles) {
        buildObstacle(scene, world, obstacle);
    }
}

function buildLine(scene: THREE.Scene, z: number, kind: 'start' | 'finish'): void {
    const texture = checkerTexture(16, 2, '#ffffff', '#2b2340');
    texture.repeat.set(1, 1);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 1), createToonMaterial(0xffffff, { map: texture }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, z);
    scene.add(line);

    if (kind === 'start') {
        return;
    }

    const postMaterial = toonMaterial(palette.coral);
    for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5, 12), postMaterial);
        post.position.set(side * (HALF_WIDTH + 0.3), 2.5, z);
        addOutline(post);
        scene.add(post);
    }

    const banner = new THREE.Mesh(new RoundedBoxGeometry(HALF_WIDTH * 2 + 1, 1.2, 0.3, 2, 0.1), createToonMaterial(0xffffff, { map: checkerTexture(24, 3, '#ffffff', '#2b2340') }));
    banner.position.set(0, 5, z);
    addOutline(banner);
    scene.add(banner);
}

function buildObstacle(scene: THREE.Scene, world: StaticWorld, obstacle: Obstacle): void {
    if (obstacle.kind === 'box') {
        const mesh = new THREE.Mesh(new RoundedBoxGeometry(obstacle.width, obstacle.height, obstacle.depth, 2, 0.15), toonMaterial(partyColors[obstacle.color % partyColors.length]));
        mesh.position.set(obstacle.x, obstacle.height / 2, obstacle.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        addOutline(mesh);
        scene.add(mesh);
        world.addBox({ x: obstacle.x, y: obstacle.height / 2, z: obstacle.z }, { x: obstacle.width, y: obstacle.height, z: obstacle.depth });
        return;
    }

    const bumper = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(obstacle.radius, obstacle.radius * 1.1, 1.2, 20), toonMaterial(palette.coral));
    base.position.y = 0.6;
    addOutline(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(obstacle.radius, 0.12, 8, 24), toonMaterial(palette.white));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.8;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(obstacle.radius * 0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toonMaterial(palette.sun));
    cap.position.y = 1.2;
    bumper.add(base, ring, cap);
    bumper.position.set(obstacle.x, 0, obstacle.z);
    bumper.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
        }
    });
    bumper.name = 'bumper';
    scene.add(bumper);
    world.addCylinder(obstacle.x, 0, obstacle.z, obstacle.radius, 1.4, { walkable: false });
}

/** Beach-ball style stripes in the player's colour. */
export function createBallMesh(color: number): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const css = `#${color.toString(16).padStart(6, '0')}`;

    if (context) {
        for (let index = 0; index < 6; index++) {
            context.fillStyle = index % 2 === 0 ? css : '#ffffff';
            context.fillRect((index * 256) / 6, 0, 256 / 6 + 1, 128);
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 256, 10);
        context.fillRect(0, 118, 256, 10);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), createToonMaterial(0xffffff, { map: texture }));
    mesh.castShadow = true;
    addOutline(mesh);

    return mesh;
}
