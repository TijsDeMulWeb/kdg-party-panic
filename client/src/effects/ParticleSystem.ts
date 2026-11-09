import * as THREE from 'three';
import { createToonMaterial } from '../design/materials';
import { pick, randomRange } from '../utils/math';

export interface EmitOptions {
    position: THREE.Vector3;
    count: number;
    colors: readonly number[];
    /** Initial speed range. */
    speed: [number, number];
    /** Extra upward velocity. */
    lift?: number;
    /** 0 = only horizontal, 1 = full sphere. */
    spread?: number;
    size: [number, number];
    life: [number, number];
    gravity?: number;
    drag?: number;
    spin?: number;
}

interface Particle {
    alive: boolean;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: THREE.Euler;
    spin: THREE.Vector3;
    size: number;
    life: number;
    maxLife: number;
    gravity: number;
    drag: number;
}

const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const color = new THREE.Color();

/**
 * Pooled particles rendered with a single InstancedMesh (one draw call).
 * Use one system per shape: puffs for dust, flat cards for confetti.
 */
export class ParticleSystem {
    readonly mesh: THREE.InstancedMesh;
    private readonly particles: Particle[] = [];
    private cursor = 0;

    constructor(geometry: THREE.BufferGeometry, capacity: number) {
        const material = createToonMaterial(0xffffff, { side: THREE.DoubleSide });
        this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = false;

        for (let index = 0; index < capacity; index++) {
            this.particles.push({
                alive: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                rotation: new THREE.Euler(),
                spin: new THREE.Vector3(),
                size: 0,
                life: 0,
                maxLife: 1,
                gravity: 0,
                drag: 0,
            });
            this.mesh.setMatrixAt(index, matrix.makeScale(0, 0, 0));
            this.mesh.setColorAt(index, color.set(0xffffff));
        }
    }

    static dust(capacity = 120): ParticleSystem {
        return new ParticleSystem(new THREE.IcosahedronGeometry(1, 0), capacity);
    }

    static confetti(capacity = 300): ParticleSystem {
        return new ParticleSystem(new THREE.PlaneGeometry(1, 0.6), capacity);
    }

    emit(options: EmitOptions): void {
        const spread = options.spread ?? 1;

        for (let index = 0; index < options.count; index++) {
            const slot = this.cursor;
            const particle = this.particles[slot];
            this.cursor = (this.cursor + 1) % this.particles.length;

            const angle = Math.random() * Math.PI * 2;
            const elevation = (Math.random() * 2 - 1) * spread * (Math.PI / 2);
            const speed = randomRange(...options.speed);

            particle.alive = true;
            particle.position.copy(options.position);
            particle.velocity.set(
                Math.cos(angle) * Math.cos(elevation) * speed,
                Math.sin(elevation) * speed + (options.lift ?? 0),
                Math.sin(angle) * Math.cos(elevation) * speed,
            );
            particle.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            const spin = options.spin ?? 0;
            particle.spin.set(randomRange(-spin, spin), randomRange(-spin, spin), randomRange(-spin, spin));
            particle.size = randomRange(...options.size);
            particle.maxLife = randomRange(...options.life);
            particle.life = particle.maxLife;
            particle.gravity = options.gravity ?? 0;
            particle.drag = options.drag ?? 0;

            this.mesh.setColorAt(slot, color.set(pick(options.colors)));
        }

        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }
    }

    update(dt: number): void {
        this.particles.forEach((particle, index) => {
            if (!particle.alive) {
                return;
            }

            particle.life -= dt;

            if (particle.life <= 0) {
                particle.alive = false;
                this.mesh.setMatrixAt(index, matrix.makeScale(0, 0, 0));
                return;
            }

            particle.velocity.y -= particle.gravity * dt;
            particle.velocity.multiplyScalar(Math.max(0, 1 - particle.drag * dt));
            particle.position.addScaledVector(particle.velocity, dt);
            particle.rotation.x += particle.spin.x * dt;
            particle.rotation.y += particle.spin.y * dt;
            particle.rotation.z += particle.spin.z * dt;

            // Pop in quickly, shrink out at the end of life.
            const age = 1 - particle.life / particle.maxLife;
            const grow = Math.min(1, age * 8);
            const shrink = Math.min(1, (particle.life / particle.maxLife) * 3);
            const size = particle.size * grow * shrink;

            quaternion.setFromEuler(particle.rotation);
            scale.setScalar(size);
            matrix.compose(particle.position, quaternion, scale);
            this.mesh.setMatrixAt(index, matrix);
        });

        this.mesh.instanceMatrix.needsUpdate = true;
    }
}
