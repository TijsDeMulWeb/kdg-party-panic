import type { MovementWorld, Vec3 } from '../characters/movement';

/** Returned by add* so dynamic level pieces (falling tiles) can toggle collision. */
export interface ColliderHandle {
    enabled: boolean;
}

/** Cylinders can also change size at runtime (e.g. a shrinking arena). */
export interface CylinderHandle extends ColliderHandle {
    radius: number;
}

interface BoxCollider extends ColliderHandle {
    kind: 'box';
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    bottom: number;
    top: number;
    walkable: boolean;
}

interface CylinderCollider extends ColliderHandle {
    kind: 'cylinder';
    x: number;
    z: number;
    radius: number;
    bottom: number;
    top: number;
    walkable: boolean;
}

type Collider = BoxCollider | CylinderCollider;

export interface ColliderOptions {
    /** Characters can stand on top. Defaults to true. */
    walkable?: boolean;
}

/**
 * Lightweight kinematic collision world built from axis-aligned boxes and
 * vertical cylinders. Enough for arenas and platforms; minigames that need
 * real rigid-body physics (Big Ball) will bring in Rapier.
 */
export class StaticWorld implements MovementWorld {
    private readonly colliders: Collider[] = [];

    addBox(center: Vec3, size: Vec3, options: ColliderOptions = {}): ColliderHandle {
        const collider: BoxCollider = {
            kind: 'box',
            minX: center.x - size.x / 2,
            maxX: center.x + size.x / 2,
            minZ: center.z - size.z / 2,
            maxZ: center.z + size.z / 2,
            bottom: center.y - size.y / 2,
            top: center.y + size.y / 2,
            walkable: options.walkable ?? true,
            enabled: true,
        };
        this.colliders.push(collider);

        return collider;
    }

    /** `y` is the base of the cylinder. */
    addCylinder(x: number, y: number, z: number, radius: number, height: number, options: ColliderOptions = {}): CylinderHandle {
        const collider: CylinderCollider = { kind: 'cylinder', x, z, radius, bottom: y, top: y + height, walkable: options.walkable ?? true, enabled: true };
        this.colliders.push(collider);

        return collider;
    }

    groundHeight(x: number, z: number, maxY: number, footRadius = 0): number | null {
        let best: number | null = null;

        for (const collider of this.colliders) {
            if (!collider.enabled || !collider.walkable || collider.top > maxY || !this.overlapsFoot(collider, x, z, footRadius)) {
                continue;
            }

            if (best === null || collider.top > best) {
                best = collider.top;
            }
        }

        return best;
    }

    resolveWalls(position: Vec3, radius: number, height: number, stepHeight: number): void {
        for (const collider of this.colliders) {
            // Disabled, standing on (or stepping onto) it, or entirely above/below it.
            if (!collider.enabled || position.y >= collider.top - stepHeight || position.y + height <= collider.bottom) {
                continue;
            }

            if (collider.kind === 'cylinder') {
                this.pushOutOfCylinder(collider, position, radius);
            } else {
                this.pushOutOfBox(collider, position, radius);
            }
        }
    }

    private overlapsFoot(collider: Collider, x: number, z: number, footRadius: number): boolean {
        if (collider.kind === 'cylinder') {
            return Math.hypot(x - collider.x, z - collider.z) <= collider.radius + footRadius;
        }

        const closestX = Math.min(Math.max(x, collider.minX), collider.maxX);
        const closestZ = Math.min(Math.max(z, collider.minZ), collider.maxZ);

        return Math.hypot(x - closestX, z - closestZ) <= footRadius;
    }

    private pushOutOfCylinder(collider: CylinderCollider, position: Vec3, radius: number): void {
        const dx = position.x - collider.x;
        const dz = position.z - collider.z;
        const distance = Math.hypot(dx, dz);
        const minimum = collider.radius + radius;

        if (distance >= minimum) {
            return;
        }

        const nx = distance > 1e-6 ? dx / distance : 1;
        const nz = distance > 1e-6 ? dz / distance : 0;
        position.x = collider.x + nx * minimum;
        position.z = collider.z + nz * minimum;
    }

    private pushOutOfBox(collider: BoxCollider, position: Vec3, radius: number): void {
        const closestX = Math.min(Math.max(position.x, collider.minX), collider.maxX);
        const closestZ = Math.min(Math.max(position.z, collider.minZ), collider.maxZ);
        const dx = position.x - closestX;
        const dz = position.z - closestZ;
        const distance = Math.hypot(dx, dz);

        if (distance > 1e-6) {
            if (distance < radius) {
                position.x = closestX + (dx / distance) * radius;
                position.z = closestZ + (dz / distance) * radius;
            }
            return;
        }

        // Centre is inside the box: exit through the nearest face.
        const exits = [
            { axis: 'x', value: collider.minX - radius, depth: position.x - collider.minX },
            { axis: 'x', value: collider.maxX + radius, depth: collider.maxX - position.x },
            { axis: 'z', value: collider.minZ - radius, depth: position.z - collider.minZ },
            { axis: 'z', value: collider.maxZ + radius, depth: collider.maxZ - position.z },
        ];
        const nearest = exits.reduce((best, exit) => (exit.depth < best.depth ? exit : best));

        if (nearest.axis === 'x') {
            position.x = nearest.value;
        } else {
            position.z = nearest.value;
        }
    }
}
