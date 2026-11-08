import * as THREE from 'three';
import type { CharacterDefinition } from './roster';
import { addOutline, toonMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { clamp, damp, randomRange } from '../utils/math';

export interface CharacterMotion {
    /** Horizontal speed as a fraction of max speed (0..1+). */
    speed: number;
    grounded: boolean;
    verticalVelocity: number;
}

/** Body profile (radius, height) revolved into a rounded gumdrop shape. */
const BODY_PROFILE = new THREE.SplineCurve([
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.4, 0.03),
    new THREE.Vector2(0.54, 0.22),
    new THREE.Vector2(0.55, 0.5),
    new THREE.Vector2(0.47, 0.86),
    new THREE.Vector2(0.28, 1.08),
    new THREE.Vector2(0.001, 1.16),
]);

const sharedGeometry = {
    body: new THREE.LatheGeometry(BODY_PROFILE.getPoints(24), 32),
    sphere: new THREE.SphereGeometry(1, 20, 14),
    stalk: new THREE.CylinderGeometry(0.025, 0.035, 0.28, 8),
    ear: new THREE.ConeGeometry(0.16, 0.38, 12),
};

/**
 * Procedural cartoon character. Purely visual: it has no notion of input
 * or physics and just reacts to the motion values it is given, so the
 * same model works for the local player, remote players and menu idles.
 */
export class CharacterModel {
    readonly root = new THREE.Group();
    readonly definition: CharacterDefinition;

    private readonly squashPivot = new THREE.Group();
    private readonly body = new THREE.Group();
    private readonly eyes: THREE.Group[] = [];
    private readonly feet: THREE.Mesh[] = [];
    private readonly hands: THREE.Mesh[] = [];
    private readonly topper = new THREE.Group();

    private walkPhase = 0;
    private time = randomRange(0, 10);
    private squash = 0;
    private squashVelocity = 0;
    private lean = 0;
    private blinkTimer = randomRange(1, 4);
    private blinkProgress = 1;

    constructor(definition: CharacterDefinition) {
        this.definition = definition;
        this.root.name = `character-${definition.id}`;
        this.root.add(this.squashPivot);
        this.squashPivot.add(this.body);

        this.buildBody();
        this.buildFace();
        this.buildLimbs();
        this.buildTopper();

        this.root.traverse((object) => {
            if (object instanceof THREE.Mesh && object.material !== undefined && !(object.material instanceof THREE.ShaderMaterial)) {
                object.castShadow = true;
            }
        });
    }

    /** Squash on landing. `strength` is roughly the impact speed. */
    land(strength: number): void {
        this.squashVelocity -= clamp(strength * 0.35, 1.5, 7);
    }

    /** Stretch upwards at the start of a jump. */
    jump(): void {
        this.squashVelocity += 5;
    }

    update(dt: number, motion: CharacterMotion): void {
        this.time += dt;
        const speed = clamp(motion.speed, 0, 1.4);

        // Walk cycle runs faster the faster we move, and freezes in the air.
        if (motion.grounded) {
            this.walkPhase += dt * (7 + speed * 7) * Math.min(speed * 2, 1);
        }

        const stride = motion.grounded ? Math.min(speed * 1.5, 1) : 0.3;
        const swing = Math.sin(this.walkPhase);

        this.feet.forEach((foot, index) => {
            const phase = index === 0 ? swing : -swing;
            foot.position.z = 0.04 + phase * 0.16 * stride;
            foot.position.y = 0.07 + Math.max(0, -phase) * 0.1 * stride + (motion.grounded ? 0 : 0.05);
        });

        this.hands.forEach((hand, index) => {
            const phase = index === 0 ? -swing : swing;
            hand.position.z = phase * 0.12 * stride;
            hand.position.y = 0.48 + (motion.grounded ? 0 : 0.18) + Math.abs(phase) * 0.03;
        });

        // Spring-driven squash and stretch.
        const airStretch = motion.grounded ? 0 : clamp(motion.verticalVelocity * 0.02, -0.08, 0.14);
        const stiffness = 180;
        const damping = 12;
        this.squashVelocity += (-stiffness * (this.squash - airStretch) - damping * this.squashVelocity) * dt;
        this.squash = clamp(this.squash + this.squashVelocity * dt, -0.35, 0.3);

        const breathe = Math.sin(this.time * 2.2) * 0.015 * (1 - stride);
        const scaleY = 1 + this.squash + breathe;
        const scaleXZ = 1 - this.squash * 0.55 - breathe * 0.5;
        this.squashPivot.scale.set(scaleXZ, scaleY, scaleXZ);

        const bob = motion.grounded ? Math.abs(Math.sin(this.walkPhase)) * 0.06 * stride : 0;
        this.body.position.y = bob;

        this.lean += (speed * 0.18 - this.lean) * damp(10, dt);
        this.squashPivot.rotation.x = this.lean;

        this.topper.rotation.z = Math.sin(this.time * 3 + this.walkPhase) * 0.08 * (0.4 + stride);
        this.updateBlink(dt);
    }

    private updateBlink(dt: number): void {
        this.blinkTimer -= dt;

        if (this.blinkTimer <= 0) {
            this.blinkProgress = 0;
            this.blinkTimer = randomRange(2, 5);
        }

        this.blinkProgress = Math.min(1, this.blinkProgress + dt * 8);
        const open = this.blinkProgress < 1 ? Math.abs(this.blinkProgress * 2 - 1) : 1;

        for (const eye of this.eyes) {
            eye.scale.y = Math.max(0.08, open);
        }
    }

    private buildBody(): void {
        const { body, accent } = this.definition;

        const shell = new THREE.Mesh(sharedGeometry.body, toonMaterial(body));
        shell.name = 'body';
        addOutline(shell);
        this.body.add(shell);

        const belly = new THREE.Mesh(sharedGeometry.sphere, toonMaterial(accent));
        belly.scale.set(0.3, 0.27, 0.12);
        belly.position.set(0, 0.36, 0.45);
        belly.rotation.x = -0.15;
        this.body.add(belly);
    }

    private buildFace(): void {
        const white = toonMaterial(palette.white);
        const ink = toonMaterial(palette.ink);

        for (const side of [-1, 1]) {
            const eye = new THREE.Group();
            eye.position.set(side * 0.17, 0.76, 0.4);
            eye.rotation.y = side * 0.32;

            const sclera = new THREE.Mesh(sharedGeometry.sphere, white);
            sclera.scale.set(0.12, 0.15, 0.08);
            const pupil = new THREE.Mesh(sharedGeometry.sphere, ink);
            pupil.scale.set(0.075, 0.095, 0.05);
            pupil.position.set(-side * 0.01, -0.01, 0.055);
            const shine = new THREE.Mesh(sharedGeometry.sphere, white);
            shine.scale.setScalar(0.024);
            shine.position.set(0.025, 0.035, 0.1);

            eye.add(sclera, pupil, shine);
            this.eyes.push(eye);
            this.body.add(eye);

            const cheek = new THREE.Mesh(sharedGeometry.sphere, toonMaterial(palette.bubblegum));
            cheek.scale.set(0.07, 0.04, 0.03);
            cheek.position.set(side * 0.3, 0.6, 0.43);
            cheek.rotation.y = side * 0.6;
            this.body.add(cheek);
        }

        const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 16, Math.PI), ink);
        mouth.position.set(0, 0.62, 0.52);
        mouth.rotation.set(0.25, 0, Math.PI);
        this.body.add(mouth);
    }

    private buildLimbs(): void {
        const feetMaterial = toonMaterial(this.definition.feet);
        const bodyMaterial = toonMaterial(this.definition.body);

        for (const side of [-1, 1]) {
            const foot = new THREE.Mesh(sharedGeometry.sphere, feetMaterial);
            foot.scale.set(0.15, 0.09, 0.2);
            foot.position.set(side * 0.22, 0.07, 0.04);
            addOutline(foot).scale.setScalar(1.2);
            this.feet.push(foot);
            this.squashPivot.add(foot);

            const hand = new THREE.Mesh(sharedGeometry.sphere, bodyMaterial);
            hand.scale.setScalar(0.1);
            hand.position.set(side * 0.6, 0.48, 0);
            addOutline(hand).scale.setScalar(1.25);
            this.hands.push(hand);
            this.body.add(hand);
        }
    }

    private buildTopper(): void {
        const { topper, body, feet, accent } = this.definition;
        this.topper.position.y = 1.12;
        this.body.add(this.topper);

        if (topper === 'antenna') {
            const stalk = new THREE.Mesh(sharedGeometry.stalk, toonMaterial(palette.ink));
            stalk.position.y = 0.14;
            const bulb = new THREE.Mesh(sharedGeometry.sphere, toonMaterial(palette.sun));
            bulb.scale.setScalar(0.09);
            bulb.position.y = 0.3;
            addOutline(bulb).scale.setScalar(1.3);
            this.topper.add(stalk, bulb);
        }

        if (topper === 'ears') {
            for (const side of [-1, 1]) {
                const ear = new THREE.Mesh(sharedGeometry.ear, toonMaterial(body));
                ear.position.set(side * 0.24, 0, 0);
                ear.rotation.z = -side * 0.45;
                addOutline(ear).scale.setScalar(1.15);
                const inner = new THREE.Mesh(sharedGeometry.ear, toonMaterial(accent));
                inner.scale.set(0.55, 0.6, 0.3);
                inner.position.set(0, -0.02, 0.08);
                ear.add(inner);
                this.topper.add(ear);
            }
        }

        if (topper === 'crest') {
            [0.14, 0.2, 0.13].forEach((size, index) => {
                const spike = new THREE.Mesh(sharedGeometry.sphere, toonMaterial(feet));
                spike.scale.set(0.06, size, size * 0.8);
                spike.position.set(0, -0.02 + size * 0.4, 0.14 - index * 0.16);
                spike.rotation.x = -0.3 + index * 0.3;
                addOutline(spike).scale.setScalar(1.2);
                this.topper.add(spike);
            });
        }

        if (topper === 'sprout') {
            const stem = new THREE.Mesh(sharedGeometry.stalk, toonMaterial(feet));
            stem.position.y = 0.1;
            stem.scale.y = 0.7;
            this.topper.add(stem);

            for (const side of [-1, 1]) {
                const leaf = new THREE.Mesh(sharedGeometry.sphere, toonMaterial(0x7ed957));
                leaf.scale.set(0.15, 0.04, 0.08);
                leaf.position.set(side * 0.13, 0.22, 0);
                leaf.rotation.z = side * 0.5;
                addOutline(leaf).scale.setScalar(1.25);
                this.topper.add(leaf);
            }
        }
    }
}
