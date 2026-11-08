import * as THREE from 'three';
import { palette } from './palette';
import { seasonTheme } from './season';
import { toonMaterial } from './materials';
import { randomRange } from '../utils/math';

/** Gradient sky dome. Rendered behind everything and ignores fog. */
export function createSky(radius = 400): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(palette.skyTop) },
            horizonColor: { value: new THREE.Color(palette.skyHorizon) },
        },
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            void main() {
                vWorld = normalize(position);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 topColor;
            uniform vec3 horizonColor;
            varying vec3 vWorld;
            void main() {
                float t = smoothstep(-0.15, 0.6, vWorld.y);
                gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
                #include <colorspace_fragment>
            }
        `,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
    });

    const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
    sky.name = 'sky';
    sky.renderOrder = -1;

    return sky;
}

export interface Lighting {
    sun: THREE.DirectionalLight;
    /** Keeps the shadow frustum centred on a moving point of interest. */
    follow(target: THREE.Vector3): void;
}

/** Bright, soft studio lighting used by every scene. */
export function createLighting(scene: THREE.Scene, shadowSize = 18): Lighting {
    const spooky = seasonTheme().season === 'halloween';
    const hemisphere = new THREE.HemisphereLight(spooky ? 0xd9c2ff : 0xdff4ff, spooky ? 0x6a4a3a : 0xa58a6a, spooky ? 1.35 : 1.6);
    scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(spooky ? 0xffb874 : 0xfff3d6, spooky ? 2.1 : 2.4);
    const sunOffset = new THREE.Vector3(8, 16, 6);
    sun.position.copy(sunOffset);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -shadowSize;
    sun.shadow.camera.right = shadowSize;
    sun.shadow.camera.top = shadowSize;
    sun.shadow.camera.bottom = -shadowSize;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    scene.add(sun);
    scene.add(sun.target);

    scene.fog = new THREE.Fog(palette.fog, 45, 140);

    return {
        sun,
        follow(target: THREE.Vector3): void {
            sun.target.position.copy(target);
            sun.position.copy(target).add(sunOffset);
        },
    };
}

/** A puffy low-poly cloud made from a few overlapping spheres. */
export function createCloud(scale = 1): THREE.Group {
    const cloud = new THREE.Group();
    const material = toonMaterial(palette.cloud);
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const puffs = 3 + Math.floor(Math.random() * 3);

    for (let index = 0; index < puffs; index++) {
        const puff = new THREE.Mesh(geometry, material);
        const size = randomRange(1.2, 2.2);
        puff.scale.set(size, size * 0.8, size);
        puff.position.set((index - puffs / 2) * 1.6 + randomRange(-0.3, 0.3), randomRange(-0.2, 0.6), randomRange(-0.5, 0.5));
        cloud.add(puff);
    }

    cloud.scale.setScalar(scale);

    return cloud;
}

export interface CloudLayer {
    group: THREE.Group;
    update(dt: number): void;
}

/** A ring of slowly drifting clouds around the play area. */
export function createCloudLayer(count: number, minRadius: number, maxRadius: number, minY: number, maxY: number): CloudLayer {
    const group = new THREE.Group();
    const clouds: { mesh: THREE.Group; speed: number }[] = [];

    for (let index = 0; index < count; index++) {
        const mesh = createCloud(randomRange(0.8, 1.8));
        const angle = (index / count) * Math.PI * 2 + randomRange(-0.2, 0.2);
        const radius = randomRange(minRadius, maxRadius);
        mesh.position.set(Math.cos(angle) * radius, randomRange(minY, maxY), Math.sin(angle) * radius);
        group.add(mesh);
        clouds.push({ mesh, speed: randomRange(0.015, 0.04) });
    }

    return {
        group,
        update(dt: number): void {
            for (const cloud of clouds) {
                const { x, z } = cloud.mesh.position;
                const angle = Math.atan2(z, x) + cloud.speed * dt;
                const radius = Math.hypot(x, z);
                cloud.mesh.position.x = Math.cos(angle) * radius;
                cloud.mesh.position.z = Math.sin(angle) * radius;
            }
        },
    };
}
