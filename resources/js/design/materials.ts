import * as THREE from 'three';
import { palette } from './palette';

let gradientMap: THREE.DataTexture | null = null;

/** Three-step ramp that gives MeshToonMaterial its cel-shaded look. */
function toonGradient(): THREE.DataTexture {
    if (gradientMap) {
        return gradientMap;
    }

    const steps = new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
    gradientMap = new THREE.DataTexture(steps, 3, 1, THREE.RGBAFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;

    return gradientMap;
}

const toonCache = new Map<number, THREE.MeshToonMaterial>();

/** Shared toon material per colour. Do not mutate the returned instance. */
export function toonMaterial(color: number): THREE.MeshToonMaterial {
    let material = toonCache.get(color);

    if (!material) {
        material = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
        material.userData.shared = true;
        toonCache.set(color, material);
    }

    return material;
}

/** Unshared toon material, for objects that animate colour or opacity. */
export function createToonMaterial(color: number, options: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...options });
}

let outlineMaterial: THREE.ShaderMaterial | null = null;

/**
 * Inverted-hull outline: back faces pushed out along their normals and
 * drawn in a flat ink colour. Cheap, and works with any rounded mesh.
 */
export function inkOutlineMaterial(): THREE.ShaderMaterial {
    if (outlineMaterial) {
        return outlineMaterial;
    }

    outlineMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(palette.ink) },
            thickness: { value: 0.035 },
        },
        vertexShader: /* glsl */ `
            uniform float thickness;
            void main() {
                vec3 displaced = position + normalize(normal) * thickness;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 color;
            void main() {
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide,
    });
    outlineMaterial.userData.shared = true;

    return outlineMaterial;
}

/** Adds an ink outline mesh as a child of `mesh`, sharing its geometry. */
export function addOutline(mesh: THREE.Mesh): THREE.Mesh {
    const outline = new THREE.Mesh(mesh.geometry, inkOutlineMaterial());
    outline.name = `${mesh.name}-outline`;
    mesh.add(outline);

    return outline;
}
