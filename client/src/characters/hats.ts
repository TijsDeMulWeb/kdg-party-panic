import * as THREE from 'three';
import { addOutline, toonMaterial } from '../design/materials';
import { palette } from '../design/palette';

export interface HatDefinition {
    id: string;
    name: string;
}

/** Cosmetic hats. Ids match the backend `hats` lookup table. */
export const HATS: readonly HatDefinition[] = [
    { id: 'party-hat', name: 'Party hat' },
    { id: 'crown', name: 'Crown' },
    { id: 'cap', name: 'Cap' },
    { id: 'bow', name: 'Bow' },
    { id: 'flower', name: 'Flower' },
];

/** Builds a hat mesh, positioned for the top of a character's head. */
export function createHat(id: string, accent: number): THREE.Group | null {
    const hat = new THREE.Group();

    if (id === 'party-hat') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 20), toonMaterial(palette.bubblegum));
        cone.position.y = 0.22;
        addOutline(cone).scale.setScalar(1.06);
        const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), toonMaterial(palette.sun));
        pompom.position.y = 0.49;
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 20), toonMaterial(palette.sun));
        stripe.rotation.x = Math.PI / 2;
        stripe.position.y = 0.12;
        hat.add(cone, pompom, stripe);
        hat.rotation.z = -0.15;
    }

    if (id === 'crown') {
        const gold = toonMaterial(palette.sun);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.16, 20, 1, true), gold);
        band.position.y = 0.06;
        hat.add(band);
        for (let index = 0; index < 5; index++) {
            const angle = (index / 5) * Math.PI * 2;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), gold);
            spike.position.set(Math.cos(angle) * 0.22, 0.2, Math.sin(angle) * 0.22);
            const gem = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toonMaterial(palette.coral));
            gem.position.set(Math.cos(angle) * 0.25, 0.07, Math.sin(angle) * 0.25);
            hat.add(spike, gem);
        }
    }

    if (id === 'cap') {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toonMaterial(accent));
        dome.position.y = -0.04;
        addOutline(dome).scale.setScalar(1.04);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16, 1, false, -Math.PI / 2, Math.PI), toonMaterial(accent));
        brim.position.set(0, -0.03, 0.2);
        brim.scale.set(1, 1, 1.3);
        hat.add(dome, brim);
    }

    if (id === 'bow') {
        const material = toonMaterial(palette.coral);
        for (const side of [-1, 1]) {
            const loop = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 12), material);
            loop.rotation.z = (side * Math.PI) / 2;
            loop.position.set(side * 0.11, 0, 0);
            addOutline(loop).scale.setScalar(1.1);
            hat.add(loop);
        }
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), material);
        hat.add(knot);
        hat.position.set(0.18, -0.05, 0.1);
        hat.rotation.z = 0.4;
    }

    if (id === 'flower') {
        for (let index = 0; index < 6; index++) {
            const angle = (index / 6) * Math.PI * 2;
            const petal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toonMaterial(palette.white));
            petal.position.set(Math.cos(angle) * 0.09, 0, Math.sin(angle) * 0.09);
            petal.scale.set(1, 0.4, 1);
            hat.add(petal);
        }
        const centre = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), toonMaterial(palette.sun));
        hat.add(centre);
        hat.position.set(-0.16, -0.02, 0.08);
        hat.rotation.z = 0.3;
    }

    return hat.children.length > 0 ? hat : null;
}
