import * as THREE from 'three';
import { createToonMaterial } from '../design/materials';
import { seasonTheme } from '../design/season';

const COUNT = 260;
const RANGE = 26;
const HEIGHT = 18;

/**
 * Seasonal particles drifting down around the camera: snow at Christmas,
 * leaves at Halloween, blossom at Easter. One instanced mesh per scene.
 */
export class SeasonalAmbience {
    readonly mesh: THREE.InstancedMesh | null = null;
    private readonly offsets: { x: number; y: number; z: number; phase: number; spin: number }[] = [];
    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly euler = new THREE.Euler();
    private readonly scale = new THREE.Vector3();
    private readonly position = new THREE.Vector3();
    private time = 0;

    constructor() {
        const ambience = seasonTheme().ambience;

        if (!ambience) {
            return;
        }

        const geometry = seasonTheme().season === 'christmas' ? new THREE.IcosahedronGeometry(1, 0) : new THREE.PlaneGeometry(1.4, 1);
        this.mesh = new THREE.InstancedMesh(geometry, createToonMaterial(0xffffff, { side: THREE.DoubleSide }), COUNT);
        this.mesh.frustumCulled = false;
        this.mesh.name = 'seasonal-ambience';
        const color = new THREE.Color();

        for (let index = 0; index < COUNT; index++) {
            this.offsets.push({ x: (Math.random() - 0.5) * RANGE * 2, y: Math.random() * HEIGHT, z: (Math.random() - 0.5) * RANGE * 2, phase: Math.random() * 10, spin: (Math.random() - 0.5) * 4 });
            this.mesh.setColorAt(index, color.set(ambience.colors[index % ambience.colors.length]));
        }
    }

    /** Keeps the particles around `center` (usually the camera's focus). */
    update(dt: number, center: THREE.Vector3): void {
        const ambience = seasonTheme().ambience;

        if (!this.mesh || !ambience) {
            return;
        }

        this.time += dt;

        this.offsets.forEach((particle, index) => {
            particle.y -= ambience.speed * dt;
            if (particle.y < -2) {
                particle.y += HEIGHT;
            }

            const wrap = (value: number, middle: number): number => middle + ((((value - middle + RANGE) % (RANGE * 2)) + RANGE * 2) % (RANGE * 2)) - RANGE;
            const x = wrap(particle.x + Math.sin(this.time * 0.8 + particle.phase) * ambience.sway, center.x);
            const z = wrap(particle.z + Math.cos(this.time * 0.6 + particle.phase) * ambience.sway, center.z);

            this.position.set(x, center.y + particle.y - 3, z);
            this.euler.set(this.time * particle.spin, this.time * particle.spin * 0.7, particle.phase);
            this.quaternion.setFromEuler(this.euler);
            this.scale.setScalar(ambience.size * (0.7 + (index % 5) * 0.12));
            this.matrix.compose(this.position, this.quaternion, this.scale);
            this.mesh?.setMatrixAt(index, this.matrix);
        });

        this.mesh.instanceMatrix.needsUpdate = true;
    }
}
