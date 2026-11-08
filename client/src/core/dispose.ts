import * as THREE from 'three';

/**
 * Disposes geometries and materials of a scene graph. Materials created by
 * the shared caches in design/materials.ts are flagged `userData.shared`
 * and are kept alive for reuse.
 */
export function disposeObject(root: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    root.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
            geometries.add(object.geometry);
            const list = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of list) {
                if (!material.userData.shared) {
                    materials.add(material);
                }
            }
        }
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
}
