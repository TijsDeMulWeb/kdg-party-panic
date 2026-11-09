import * as THREE from 'three';
import { addOutline, toonMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { seasonTheme } from '../design/season';
import { randomRange } from '../utils/math';

export interface Decor {
    group: THREE.Group;
    update(dt: number, time: number): void;
}

function outlined<T extends THREE.Mesh>(mesh: T, scale = 1.06): T {
    addOutline(mesh).scale.setScalar(scale);
    mesh.castShadow = true;
    return mesh;
}

function christmasTree(): THREE.Group {
    const tree = new THREE.Group();
    const green = toonMaterial(0x2f9e5b);
    [
        [1.1, 1.3, 1.1],
        [0.85, 1.1, 1.9],
        [0.6, 0.9, 2.6],
    ].forEach(([radius, height, y]) => {
        const cone = outlined(new THREE.Mesh(new THREE.ConeGeometry(radius, height, 10), green));
        cone.position.y = y;
        tree.add(cone);
    });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), toonMaterial(palette.dirtDark));
    trunk.position.y = 0.3;
    const star = outlined(new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), toonMaterial(0xffc93c)), 1.15);
    star.position.y = 3.2;
    tree.add(trunk, star);

    const bauble = new THREE.SphereGeometry(0.09, 8, 6);
    const colors = [0xe23b3b, 0xffc93c, 0x3ea6ff, 0xffffff];
    for (let index = 0; index < 14; index++) {
        const angle = index * 2.4;
        const y = 1 + (index / 14) * 1.9;
        const radius = 1.05 - (y - 1) * 0.42;
        const ball = new THREE.Mesh(bauble, toonMaterial(colors[index % colors.length]));
        ball.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        tree.add(ball);
    }

    return tree;
}

function present(color: number): THREE.Group {
    const gift = new THREE.Group();
    const size = randomRange(0.4, 0.7);
    const box = outlined(new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.8, size), toonMaterial(color)));
    box.position.y = size * 0.4;
    const ribbonMaterial = toonMaterial(0xffc93c);
    const ribbonA = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 0.82, size * 0.15), ribbonMaterial);
    ribbonA.position.y = size * 0.4;
    const ribbonB = new THREE.Mesh(new THREE.BoxGeometry(size * 0.15, size * 0.82, size * 1.02), ribbonMaterial);
    ribbonB.position.y = size * 0.4;
    const bow = new THREE.Mesh(new THREE.TorusGeometry(size * 0.15, size * 0.05, 6, 12), ribbonMaterial);
    bow.position.y = size * 0.85;
    gift.add(box, ribbonA, ribbonB, bow);
    gift.rotation.y = randomRange(0, Math.PI);

    return gift;
}

function pumpkin(): THREE.Group {
    const group = new THREE.Group();
    const size = randomRange(0.3, 0.45);
    const body = outlined(new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), toonMaterial(0xff8a1f)));
    body.scale.set(1.2, 0.85, 1.2);
    body.position.y = size * 0.8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.1, size * 0.14, size * 0.4, 6), toonMaterial(0x5a7d2a));
    stem.position.y = size * 1.6;
    const face = toonMaterial(0x3b1d0b);
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.ConeGeometry(size * 0.18, size * 0.25, 3), face);
        eye.rotation.x = Math.PI / 2;
        eye.position.set(side * size * 0.38, size * 1.0, size * 1.12);
        group.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(size * 0.35, size * 0.07, 6, 12, Math.PI), face);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, size * 0.72, size * 1.14);
    group.add(body, stem, mouth);
    group.rotation.y = randomRange(-0.5, 0.5);

    return group;
}

function bat(): THREE.Group {
    const group = new THREE.Group();
    const material = toonMaterial(0x2b2340);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), material);
    group.add(body);
    for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), material);
        wing.rotation.z = (side * Math.PI) / 2;
        wing.position.x = side * 0.38;
        wing.scale.set(1, 1, 0.15);
        wing.name = side < 0 ? 'left' : 'right';
        group.add(wing);
    }

    return group;
}

function egg(): THREE.Group {
    const group = new THREE.Group();
    const colors = [0xffb3d9, 0xb8e6ff, 0xfff2a8, 0xc8f5c2, 0xe0c8ff];
    const size = randomRange(0.22, 0.34);
    const shell = outlined(new THREE.Mesh(new THREE.SphereGeometry(size, 14, 12), toonMaterial(colors[Math.floor(Math.random() * colors.length)])));
    shell.scale.set(1, 1.3, 1);
    shell.position.y = size * 1.25;
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(size * 0.98, size * 0.12, 6, 16), toonMaterial(colors[Math.floor(Math.random() * colors.length)]));
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = size * 1.25;
    group.add(shell, stripe);
    group.rotation.z = randomRange(-0.3, 0.3);

    return group;
}

function bunny(): THREE.Group {
    const group = new THREE.Group();
    const fur = toonMaterial(0xffffff);
    const body = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), fur));
    body.position.y = 0.35;
    const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), fur));
    head.position.set(0, 0.75, 0.12);
    group.add(body, head);
    for (const side of [-1, 1]) {
        const ear = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fur));
        ear.scale.set(1, 3.2, 0.7);
        ear.position.set(side * 0.1, 1.15, 0.08);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), toonMaterial(0xffb3d9));
        inner.scale.set(1, 3, 0.4);
        inner.position.set(side * 0.1, 1.15, 0.13);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), toonMaterial(palette.ink));
        eye.position.set(side * 0.09, 0.8, 0.33);
        group.add(ear, inner, eye);
    }

    return group;
}

/** Seasonal props around the edge of a stage island of `radius`. */
export function createSeasonalDecor(radius: number): Decor | null {
    const season = seasonTheme().season;

    if (season === 'default') {
        return null;
    }

    const group = new THREE.Group();
    const bats: THREE.Group[] = [];
    const ringSpot = (index: number, count: number, spread = 0): THREE.Vector3 => {
        const angle = Math.PI * 1.05 + (index / count) * Math.PI * 0.9 + spread;
        const distance = radius - randomRange(0.6, 1.3);
        return new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    };

    if (season === 'christmas') {
        for (const x of [-radius * 0.75, radius * 0.75]) {
            const tree = christmasTree();
            tree.position.set(x, 0, -radius * 0.45);
            group.add(tree);
        }
        for (let index = 0; index < 7; index++) {
            const gift = present([0xe23b3b, 0x2f9e5b, 0x3ea6ff, 0xffffff][index % 4]);
            gift.position.copy(ringSpot(index, 7));
            group.add(gift);
        }
    }

    if (season === 'halloween') {
        // In front of the cast, faces towards the camera.
        for (let index = 0; index < 6; index++) {
            const angle = Math.PI * 0.12 + (index / 5) * Math.PI * 0.76;
            const distance = radius - randomRange(0.8, 1.5);
            const lantern = pumpkin();
            lantern.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            lantern.rotation.y = randomRange(-0.4, 0.4);
            group.add(lantern);
        }
        for (let index = 0; index < 5; index++) {
            const flyer = bat();
            flyer.userData.phase = index * 1.3;
            bats.push(flyer);
            group.add(flyer);
        }
    }

    if (season === 'easter') {
        for (let index = 0; index < 12; index++) {
            const decoration = egg();
            decoration.position.copy(ringSpot(index, 12, randomRange(-0.1, 0.1)));
            group.add(decoration);
        }
        for (const x of [-radius * 0.7, radius * 0.7]) {
            const rabbit = bunny();
            rabbit.position.set(x, 0, -radius * 0.4);
            group.add(rabbit);
        }
    }

    return {
        group,
        update(_dt: number, time: number): void {
            for (const flyer of bats) {
                const phase = flyer.userData.phase as number;
                const angle = time * 0.6 + phase;
                flyer.position.set(Math.cos(angle) * (radius + 1), 4.5 + Math.sin(time * 2 + phase) * 0.6, Math.sin(angle) * (radius * 0.6) - 2);
                flyer.rotation.y = -angle;
                const flap = Math.sin(time * 14 + phase) * 0.6;
                flyer.getObjectByName('left')?.rotation.set(0, 0, Math.PI / 2 + flap);
                flyer.getObjectByName('right')?.rotation.set(0, 0, -Math.PI / 2 - flap);
            }
        },
    };
}
