import * as THREE from 'three';
import { addOutline, toonMaterial } from '../design/materials';
import { palette, partyColors } from '../design/palette';
import { pick, randomRange } from '../utils/math';

function shadowed<T extends THREE.Object3D>(object: T, cast = true, receive = true): T {
    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = cast;
            child.receiveShadow = receive;
        }
    });

    return object;
}

/** Floating grass island: grass cap, dirt band and a rocky underside. */
export function createIsland(radius: number, depth = 1.2): THREE.Group {
    const island = new THREE.Group();
    island.name = 'island';

    const grass = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.5, 64), toonMaterial(palette.grass));
    grass.position.y = -0.25;
    grass.receiveShadow = true;

    const lip = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.05, 0.18, 10, 64), toonMaterial(palette.grassDark));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.42;

    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.1, radius * 0.86, depth, 64), toonMaterial(palette.dirt));
    dirt.position.y = -0.5 - depth / 2;

    const rock = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.86, radius * 0.9, 10, 2), toonMaterial(palette.dirtDark));
    rock.rotation.x = Math.PI;
    rock.position.y = -0.5 - depth - radius * 0.45;

    island.add(grass, lip, dirt, rock);

    return shadowed(island, false, true);
}

/** Rounded toy block, used for steps and obstacles. */
export function createBlock(width: number, height: number, depth: number, color: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
    const block = new THREE.Mesh(geometry, toonMaterial(color));
    addOutline(block);

    return shadowed(block);
}

export function createTree(height = 2.2): THREE.Group {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, height * 0.5, 8), toonMaterial(palette.dirtDark));
    trunk.position.y = height * 0.25;
    tree.add(trunk);

    const leaves = toonMaterial(pick([palette.grassDark, 0x4fc46a, 0x8fe06a]));
    const puffs: [number, number, number, number][] = [
        [0, height * 0.62, 0, 0.85],
        [0.35, height * 0.82, 0.1, 0.6],
        [-0.3, height * 0.78, -0.15, 0.55],
        [0, height * 0.98, 0, 0.5],
    ];

    for (const [x, y, z, size] of puffs) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), leaves);
        puff.position.set(x, y, z);
        addOutline(puff);
        tree.add(puff);
    }

    return shadowed(tree);
}

export function createFlower(): THREE.Group {
    const flower = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), toonMaterial(palette.grassDark));
    stem.position.y = 0.15;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), toonMaterial(pick(partyColors)));
    head.position.y = 0.32;
    const center = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), toonMaterial(palette.sun));
    center.position.set(0, 0.33, 0.06);
    flower.add(stem, head, center);
    flower.rotation.y = randomRange(0, Math.PI * 2);

    return flower;
}

export interface Balloon {
    group: THREE.Group;
    update(dt: number, time: number): void;
}

/** Bobbing party balloon on a string. */
export function createBalloon(color: number, position: THREE.Vector3): Balloon {
    const group = new THREE.Group();
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), toonMaterial(color));
    balloon.scale.set(1, 1.2, 1);
    addOutline(balloon);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 8), toonMaterial(color));
    knot.position.y = -0.62;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 4), toonMaterial(palette.ink));
    string.position.y = -1.45;
    group.add(balloon, knot, string);
    shadowed(group, true, false);

    group.position.copy(position);
    const offset = randomRange(0, 10);

    return {
        group,
        update(_dt: number, time: number): void {
            group.position.y = position.y + Math.sin(time * 0.8 + offset) * 0.25;
            group.rotation.z = Math.sin(time * 0.6 + offset) * 0.08;
        },
    };
}
