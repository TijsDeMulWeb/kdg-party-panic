import * as THREE from 'three';
import { addOutline, toonMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { seasonTheme } from '../design/season';

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

/** Everyday hats plus the current season's special one. */
export function availableHats(): readonly HatDefinition[] {
    const seasonal = seasonTheme().hat;

    return seasonal ? [...HATS, seasonal] : HATS;
}

/** Names for every hat, including seasonal ones worn outside their season. */
export function hatName(id: string | null): string {
    const seasonalNames: Record<string, string> = { 'santa-hat': 'Santa hat', 'witch-hat': 'Witch hat', 'bunny-ears': 'Bunny ears' };

    return HATS.find((hat) => hat.id === id)?.name ?? (id ? seasonalNames[id] : undefined) ?? 'No hat';
}

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

    if (id === 'santa-hat') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 18), toonMaterial(0xe23b3b));
        cone.position.set(0, 0.25, 0);
        cone.rotation.z = -0.35;
        addOutline(cone).scale.setScalar(1.05);
        const trim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 20), toonMaterial(palette.white));
        trim.rotation.x = Math.PI / 2;
        trim.position.y = 0.02;
        const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toonMaterial(palette.white));
        pompom.position.set(0.2, 0.48, 0);
        hat.add(cone, trim, pompom);
    }

    if (id === 'witch-hat') {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 24), toonMaterial(0x2b2340));
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 18), toonMaterial(0x2b2340));
        cone.position.set(0.04, 0.36, 0);
        cone.rotation.z = -0.25;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.24, 0.08, 18), toonMaterial(0x7b3fe4));
        band.position.y = 0.07;
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.03), toonMaterial(palette.sun));
        buckle.position.set(0, 0.07, 0.24);
        addOutline(brim);
        addOutline(cone).scale.setScalar(1.05);
        hat.add(brim, cone, band, buckle);
    }

    if (id === 'bunny-ears') {
        for (const side of [-1, 1]) {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), toonMaterial(palette.white));
            ear.scale.set(1, 3.4, 0.6);
            ear.position.set(side * 0.13, 0.3, 0);
            ear.rotation.z = -side * 0.18;
            addOutline(ear).scale.setScalar(1.12);
            const inner = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toonMaterial(0xffb3d9));
            inner.scale.set(1, 3, 0.4);
            inner.position.set(side * 0.13, 0.3, 0.05);
            inner.rotation.z = -side * 0.18;
            hat.add(ear, inner);
        }
    }

    return hat.children.length > 0 ? hat : null;
}
