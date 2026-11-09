import * as THREE from 'three';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette, partyColors } from '../../design/palette';
import type { ToyPlan } from './rules';

function outlined(mesh: THREE.Mesh, scale = 1.05): THREE.Mesh {
    addOutline(mesh).scale.setScalar(scale);
    mesh.castShadow = true;
    return mesh;
}

/** Cute low-poly toys. Size grows with the toy's weight class. */
export function createToy(plan: ToyPlan): THREE.Group {
    const group = new THREE.Group();
    const color = partyColors[plan.color % partyColors.length];

    if (plan.kind === 'small' && plan.variant === 0) {
        const block = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), toonMaterial(color)), 1.08);
        block.position.y = 0.2;
        block.rotation.y = plan.id;
        group.add(block);
    }

    if (plan.kind === 'small' && plan.variant === 1) {
        const ball = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), toonMaterial(color)), 1.1);
        ball.position.y = 0.22;
        group.add(ball);
    }

    if (plan.kind === 'medium' && plan.variant === 0) {
        const body = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), toonMaterial(palette.sun)));
        body.scale.set(1.2, 0.85, 1);
        body.position.y = 0.32;
        const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), toonMaterial(palette.sun)));
        head.position.set(0.3, 0.7, 0);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), toonMaterial(palette.tangerine));
        beak.rotation.z = -Math.PI / 2;
        beak.position.set(0.55, 0.66, 0);
        group.add(body, head, beak);
    }

    if (plan.kind === 'medium' && plan.variant === 1) {
        const car = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.45), toonMaterial(color)));
        car.position.y = 0.3;
        const roof = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.4), toonMaterial(palette.white)));
        roof.position.set(-0.05, 0.55, 0);
        group.add(car, roof);
        for (const [x, z] of [
            [0.26, 0.24],
            [-0.26, 0.24],
            [0.26, -0.24],
            [-0.26, -0.24],
        ]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), toonMaterial(palette.ink));
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, 0.12, z);
            group.add(wheel);
        }
    }

    if (plan.kind === 'large') {
        const fur = toonMaterial(plan.variant === 0 ? 0xc98a5a : palette.bubblegum);
        const body = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), fur));
        body.scale.set(1, 1.1, 0.9);
        body.position.y = 0.66;
        const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), fur));
        head.position.y = 1.55;
        group.add(body, head);
        for (const side of [-1, 1]) {
            const ear = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), fur));
            ear.position.set(side * 0.36, 1.92, 0);
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toonMaterial(palette.ink));
            eye.position.set(side * 0.16, 1.62, 0.42);
            const arm = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fur));
            arm.position.set(side * 0.6, 0.9, 0.15);
            group.add(ear, eye, arm);
        }
        const snout = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), toonMaterial(0xffe2c4));
        snout.position.set(0, 1.45, 0.42);
        group.add(snout);
    }

    group.rotation.y = (plan.id * 2.39996) % (Math.PI * 2);

    return group;
}

/** A little handheld vacuum the character carries. */
export function createVacuum(color: number): THREE.Group {
    const vacuum = new THREE.Group();
    const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 14), toonMaterial(color)));
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.45, 0.55);
    const nozzle = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.14, 0.3, 14, 1, true), toonMaterial(palette.ink)));
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.45, 0.92);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 6, 16), toonMaterial(palette.sun));
    stripe.position.set(0, 0.45, 0.62);
    vacuum.add(body, nozzle, stripe);

    return vacuum;
}
