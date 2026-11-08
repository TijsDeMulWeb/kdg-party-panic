import * as THREE from 'three';
import { clamp, damp } from '../utils/math';

export interface CameraRigOptions {
    distance: number;
    height: number;
    yaw: number;
    /** Extra height added to the follow target (look slightly above feet). */
    lookHeight: number;
    followSharpness: number;
    /** Radians per pixel of pointer drag. 0 disables user rotation. */
    rotateSpeed: number;
    minPitch: number;
    maxPitch: number;
}

const DEFAULTS: CameraRigOptions = {
    distance: 11,
    height: 7,
    yaw: 0,
    lookHeight: 1,
    followSharpness: 6,
    rotateSpeed: 0.006,
    minPitch: 0.2,
    maxPitch: 1.1,
};

/**
 * Third-person follow camera shared by all scenes. Minigames with a fixed
 * view simply set `rotateSpeed` to 0.
 */
export class CameraRig {
    readonly camera: THREE.PerspectiveCamera;
    readonly options: CameraRigOptions;

    private yaw: number;
    private pitch: number;
    private readonly focus = new THREE.Vector3();
    private readonly desiredFocus = new THREE.Vector3();
    private shakeStrength = 0;
    private readonly shakeOffset = new THREE.Vector3();

    constructor(options: Partial<CameraRigOptions> = {}) {
        this.options = { ...DEFAULTS, ...options };
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 800);
        this.yaw = this.options.yaw;
        this.pitch = Math.atan2(this.options.height, this.options.distance);
    }

    /** Current horizontal orbit angle; used for camera-relative movement. */
    getYaw(): number {
        return this.yaw;
    }

    /** Changes orbit distance and height (e.g. per screen orientation). */
    setFraming(distance: number, height: number): void {
        this.options.distance = distance;
        this.options.height = height;
        this.pitch = Math.atan2(height, distance);
    }

    rotate(deltaX: number, deltaY: number): void {
        const { rotateSpeed, minPitch, maxPitch } = this.options;
        this.yaw -= deltaX * rotateSpeed;
        this.pitch = clamp(this.pitch + deltaY * rotateSpeed * 0.6, minPitch, maxPitch);
    }

    setTarget(target: THREE.Vector3): void {
        this.desiredFocus.copy(target);
    }

    /** Jumps straight to the target without smoothing (spawns, cuts). */
    snap(target: THREE.Vector3): void {
        this.desiredFocus.copy(target);
        this.focus.copy(target);
        this.apply();
    }

    shake(strength: number): void {
        this.shakeStrength = Math.max(this.shakeStrength, strength);
    }

    resize(width: number, height: number): void {
        this.camera.aspect = width / height;
        // Pull back a little on portrait screens so the action stays in frame.
        this.camera.fov = this.camera.aspect < 1 ? 62 : 50;
        this.camera.updateProjectionMatrix();
    }

    update(dt: number): void {
        this.focus.lerp(this.desiredFocus, damp(this.options.followSharpness, dt));

        this.shakeStrength = Math.max(0, this.shakeStrength - dt * 2.5);
        const shake = this.shakeStrength * this.shakeStrength;
        this.shakeOffset.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

        this.apply();
    }

    private apply(): void {
        const radius = Math.hypot(this.options.distance, this.options.height);
        const horizontal = Math.cos(this.pitch) * radius;

        this.camera.position.set(
            this.focus.x + Math.sin(this.yaw) * horizontal,
            this.focus.y + this.options.lookHeight + Math.sin(this.pitch) * radius,
            this.focus.z + Math.cos(this.yaw) * horizontal,
        );
        this.camera.position.add(this.shakeOffset);
        this.camera.lookAt(this.focus.x, this.focus.y + this.options.lookHeight, this.focus.z);
    }
}
