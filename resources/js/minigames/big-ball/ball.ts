import type { Obstacle } from './rules';

/**
 * Minimal rolling-ball physics on a flat course: friction, bounces off
 * boxes, bouncy bumpers and other balls. Pure and deterministic.
 */

export interface BallState {
    x: number;
    z: number;
    vx: number;
    vz: number;
    radius: number;
}

export interface Circle {
    x: number;
    z: number;
    radius: number;
}

export interface Bounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface BallEvents {
    bumped: boolean;
    hitWall: number;
}

const MAX_SPEED = 11;
const ROLLING_DRAG = 0.8;
const ROLLING_RESISTANCE = 0.6;
const WALL_RESTITUTION = 0.4;
const BUMPER_RESTITUTION = 1.25;
const BUMPER_MIN_SPEED = 6;

export function stepBall(ball: BallState, dt: number, obstacles: readonly Obstacle[], others: readonly Circle[], bounds: Bounds): BallEvents {
    const events: BallEvents = { bumped: false, hitWall: 0 };

    const speed = Math.hypot(ball.vx, ball.vz);
    if (speed > 0) {
        const slowed = Math.max(0, speed * Math.exp(-ROLLING_DRAG * dt) - ROLLING_RESISTANCE * dt);
        const scale = Math.min(slowed, MAX_SPEED) / speed;
        ball.vx *= scale;
        ball.vz *= scale;
    }

    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;

    for (const obstacle of obstacles) {
        if (obstacle.kind === 'box') {
            const impact = collideBox(ball, obstacle.x, obstacle.z, obstacle.width / 2, obstacle.depth / 2);
            events.hitWall = Math.max(events.hitWall, impact);
            continue;
        }

        if (collideCircle(ball, obstacle, BUMPER_RESTITUTION) > 0) {
            events.bumped = true;
            const outgoing = Math.hypot(ball.vx, ball.vz);
            if (outgoing < BUMPER_MIN_SPEED && outgoing > 0) {
                ball.vx *= BUMPER_MIN_SPEED / outgoing;
                ball.vz *= BUMPER_MIN_SPEED / outgoing;
            }
        }
    }

    for (const other of others) {
        events.hitWall = Math.max(events.hitWall, collideCircle(ball, other, 0.7));
    }

    events.hitWall = Math.max(events.hitWall, collideBounds(ball, bounds));

    return events;
}

/** Pushes the ball out of a circle and reflects its velocity. Returns impact speed. */
function collideCircle(ball: BallState, circle: Circle, restitution: number): number {
    const dx = ball.x - circle.x;
    const dz = ball.z - circle.z;
    const distance = Math.hypot(dx, dz);
    const minimum = ball.radius + circle.radius;

    if (distance >= minimum || distance < 1e-6) {
        return 0;
    }

    const nx = dx / distance;
    const nz = dz / distance;
    ball.x = circle.x + nx * minimum;
    ball.z = circle.z + nz * minimum;

    return reflect(ball, nx, nz, restitution);
}

function collideBox(ball: BallState, centerX: number, centerZ: number, halfWidth: number, halfDepth: number): number {
    const closestX = Math.min(Math.max(ball.x, centerX - halfWidth), centerX + halfWidth);
    const closestZ = Math.min(Math.max(ball.z, centerZ - halfDepth), centerZ + halfDepth);
    const dx = ball.x - closestX;
    const dz = ball.z - closestZ;
    const distance = Math.hypot(dx, dz);

    if (distance >= ball.radius) {
        return 0;
    }

    // Centre inside the box (very fast ball): push out along the shallowest axis.
    if (distance < 1e-6) {
        const pushX = halfWidth - Math.abs(ball.x - centerX);
        const pushZ = halfDepth - Math.abs(ball.z - centerZ);
        const nx = pushX < pushZ ? Math.sign(ball.x - centerX) || 1 : 0;
        const nz = pushX < pushZ ? 0 : Math.sign(ball.z - centerZ) || 1;
        ball.x += nx * (pushX + ball.radius);
        ball.z += nz * (pushZ + ball.radius);
        return reflect(ball, nx, nz, WALL_RESTITUTION);
    }

    const nx = dx / distance;
    const nz = dz / distance;
    ball.x = closestX + nx * ball.radius;
    ball.z = closestZ + nz * ball.radius;

    return reflect(ball, nx, nz, WALL_RESTITUTION);
}

function collideBounds(ball: BallState, bounds: Bounds): number {
    let impact = 0;

    if (ball.x - ball.radius < bounds.minX) {
        ball.x = bounds.minX + ball.radius;
        impact = Math.max(impact, reflect(ball, 1, 0, WALL_RESTITUTION));
    }
    if (ball.x + ball.radius > bounds.maxX) {
        ball.x = bounds.maxX - ball.radius;
        impact = Math.max(impact, reflect(ball, -1, 0, WALL_RESTITUTION));
    }
    if (ball.z - ball.radius < bounds.minZ) {
        ball.z = bounds.minZ + ball.radius;
        impact = Math.max(impact, reflect(ball, 0, 1, WALL_RESTITUTION));
    }
    if (ball.z + ball.radius > bounds.maxZ) {
        ball.z = bounds.maxZ - ball.radius;
        impact = Math.max(impact, reflect(ball, 0, -1, WALL_RESTITUTION));
    }

    return impact;
}

function reflect(ball: BallState, nx: number, nz: number, restitution: number): number {
    const into = ball.vx * nx + ball.vz * nz;

    if (into >= 0) {
        return 0;
    }

    ball.vx -= (1 + restitution) * into * nx;
    ball.vz -= (1 + restitution) * into * nz;

    return -into;
}

/**
 * A character walking into the ball: the ball is pushed out of the way
 * and picks up most of the character's speed along the contact normal.
 * Returns how far the character must be moved back.
 */
export function pushBall(ball: BallState, player: Circle, playerVx: number, playerVz: number, strength = 1.15): { x: number; z: number } | null {
    const dx = ball.x - player.x;
    const dz = ball.z - player.z;
    const distance = Math.hypot(dx, dz);
    const minimum = ball.radius + player.radius;

    if (distance >= minimum || distance < 1e-6) {
        return null;
    }

    const nx = dx / distance;
    const nz = dz / distance;
    const overlap = minimum - distance;

    ball.x += nx * overlap * 0.85;
    ball.z += nz * overlap * 0.85;

    const along = playerVx * nx + playerVz * nz;
    const ballAlong = ball.vx * nx + ball.vz * nz;

    if (along * strength > ballAlong) {
        ball.vx += nx * (along * strength - ballAlong);
        ball.vz += nz * (along * strength - ballAlong);
    }

    return { x: -nx * overlap * 0.15, z: -nz * overlap * 0.15 };
}
