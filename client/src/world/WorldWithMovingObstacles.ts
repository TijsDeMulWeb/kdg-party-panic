import type { MovementWorld, Vec3 } from '../characters/movement';

export interface MovingObstacle {
    x: number;
    y: number;
    z: number;
    radius: number;
}

/**
 * Adds moving round obstacles (other players) on top of a static world.
 * Each client only pushes its own character out, so bumping is symmetric
 * without anyone needing authority over someone else's position.
 */
export class WorldWithMovingObstacles implements MovementWorld {
    constructor(
        private readonly base: MovementWorld,
        private readonly obstacles: () => readonly MovingObstacle[],
    ) {}

    groundHeight(x: number, z: number, maxY: number, footRadius: number): number | null {
        return this.base.groundHeight(x, z, maxY, footRadius);
    }

    resolveWalls(position: Vec3, radius: number, height: number, stepHeight: number): void {
        this.base.resolveWalls(position, radius, height, stepHeight);

        for (const obstacle of this.obstacles()) {
            if (Math.abs(obstacle.y - position.y) > height) {
                continue;
            }

            const dx = position.x - obstacle.x;
            const dz = position.z - obstacle.z;
            const distance = Math.hypot(dx, dz);
            const minimum = radius + obstacle.radius;

            if (distance >= minimum || distance < 1e-6) {
                continue;
            }

            position.x = obstacle.x + (dx / distance) * minimum;
            position.z = obstacle.z + (dz / distance) * minimum;
        }
    }
}
