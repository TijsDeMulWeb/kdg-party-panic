import type * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';
import { palette } from '../design/palette';
import { seasonTheme } from '../design/season';

/** Ready-made particle presets shared by every scene. */
export class Effects {
    private readonly dust = ParticleSystem.dust();
    private readonly confettiSystem = ParticleSystem.confetti();

    constructor(scene: THREE.Scene) {
        scene.add(this.dust.mesh, this.confettiSystem.mesh);
    }

    landing(position: THREE.Vector3, strength: number): void {
        const intensity = Math.min(1, strength / 20);
        this.dust.emit({
            position,
            count: Math.round(4 + intensity * 10),
            colors: [palette.white, 0xf3ecff],
            speed: [1.5, 2.5 + intensity * 3],
            lift: 0.6,
            spread: 0.1,
            size: [0.1, 0.18 + intensity * 0.12],
            life: [0.3, 0.55],
            drag: 4,
        });
    }

    jump(position: THREE.Vector3): void {
        this.dust.emit({
            position,
            count: 5,
            colors: [palette.white],
            speed: [1, 2],
            spread: 0.1,
            size: [0.08, 0.14],
            life: [0.25, 0.4],
            drag: 5,
        });
    }

    dash(position: THREE.Vector3, color: number): void {
        this.dust.emit({
            position,
            count: 8,
            colors: [palette.white, color],
            speed: [1, 3],
            lift: 0.5,
            spread: 0.4,
            size: [0.1, 0.2],
            life: [0.25, 0.45],
            drag: 6,
        });
    }

    poof(position: THREE.Vector3): void {
        this.dust.emit({
            position,
            count: 22,
            colors: [palette.white, 0xe9e2ff],
            speed: [2, 5],
            lift: 1,
            size: [0.18, 0.35],
            life: [0.4, 0.8],
            drag: 4,
        });
    }

    confetti(position: THREE.Vector3, count = 60): void {
        this.confettiSystem.emit({
            position,
            count,
            colors: seasonTheme().confetti,
            speed: [4, 9],
            lift: 5,
            spread: 0.9,
            size: [0.12, 0.22],
            life: [1.8, 3],
            gravity: 7,
            drag: 1.6,
            spin: 10,
        });
    }

    update(dt: number): void {
        this.dust.update(dt);
        this.confettiSystem.update(dt);
    }
}
