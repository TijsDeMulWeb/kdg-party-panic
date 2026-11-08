/**
 * Pure character movement simulation. Deliberately free of Three.js and
 * the DOM, so it can be unit tested and reused outside the browser
 * (for example to replay inputs when validating scores).
 */

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface MovementInput {
    /** World-space desired direction (x, z). Length <= 1. */
    moveX: number;
    moveZ: number;
    jumpPressed: boolean;
    jumpHeld: boolean;
    dashPressed: boolean;
}

export interface MovementConfig {
    maxSpeed: number;
    acceleration: number;
    deceleration: number;
    airControl: number;
    turnSpeed: number;
    jumpVelocity: number;
    gravity: number;
    fallGravityMultiplier: number;
    lowJumpGravityMultiplier: number;
    maxFallSpeed: number;
    coyoteTime: number;
    jumpBufferTime: number;
    dashSpeed: number;
    dashDuration: number;
    dashCooldown: number;
    radius: number;
    height: number;
    stepHeight: number;
}

/** Fraction of the body radius that still counts as standing on a ledge. */
const FOOT_RATIO = 0.5;

export const DEFAULT_MOVEMENT: MovementConfig = {
    maxSpeed: 7,
    acceleration: 60,
    deceleration: 45,
    airControl: 0.55,
    turnSpeed: 16,
    jumpVelocity: 11,
    gravity: 32,
    fallGravityMultiplier: 1.5,
    lowJumpGravityMultiplier: 2.2,
    maxFallSpeed: 30,
    coyoteTime: 0.1,
    jumpBufferTime: 0.12,
    dashSpeed: 15,
    dashDuration: 0.18,
    dashCooldown: 0.7,
    radius: 0.5,
    height: 1.2,
    stepHeight: 0.3,
};

export interface MovementState {
    position: Vec3;
    velocity: Vec3;
    /** Yaw in radians; 0 faces +z. */
    facing: number;
    grounded: boolean;
    coyoteTimer: number;
    jumpBufferTimer: number;
    dashTimer: number;
    dashCooldownTimer: number;
}

export interface MovementEvents {
    jumped: boolean;
    landed: boolean;
    landingSpeed: number;
    dashed: boolean;
}

/** Static level geometry the character moves against. */
export interface MovementWorld {
    /**
     * Highest walkable surface under a foot circle of `footRadius` around (x, z)
     * that is at or below `maxY`, or null over the void.
     */
    groundHeight(x: number, z: number, maxY: number, footRadius: number): number | null;
    /** Pushes a vertical cylinder out of solid walls. Mutates `position`. */
    resolveWalls(position: Vec3, radius: number, height: number, stepHeight: number): void;
}

export function createMovementState(position: Vec3, facing = 0): MovementState {
    return {
        position: { ...position },
        velocity: { x: 0, y: 0, z: 0 },
        facing,
        grounded: true,
        coyoteTimer: 0,
        jumpBufferTimer: 0,
        dashTimer: 0,
        dashCooldownTimer: 0,
    };
}

export function stepMovement(
    state: MovementState,
    input: MovementInput,
    config: MovementConfig,
    world: MovementWorld,
    dt: number,
): MovementEvents {
    const events: MovementEvents = { jumped: false, landed: false, landingSpeed: 0, dashed: false };
    const { position, velocity } = state;

    let inputX = input.moveX;
    let inputZ = input.moveZ;
    const inputLength = Math.hypot(inputX, inputZ);

    if (inputLength > 1) {
        inputX /= inputLength;
        inputZ /= inputLength;
    }

    // Facing follows the stick direction.
    if (inputLength > 0.1) {
        const targetFacing = Math.atan2(inputX, inputZ);
        state.facing += shortestAngle(state.facing, targetFacing) * Math.min(1, config.turnSpeed * dt);
    }

    // Dash: a short burst in the facing direction.
    state.dashCooldownTimer = Math.max(0, state.dashCooldownTimer - dt);
    if (input.dashPressed && state.dashCooldownTimer === 0) {
        state.dashTimer = config.dashDuration;
        state.dashCooldownTimer = config.dashCooldown;
        const dirX = inputLength > 0.1 ? inputX / Math.min(inputLength, 1) : Math.sin(state.facing);
        const dirZ = inputLength > 0.1 ? inputZ / Math.min(inputLength, 1) : Math.cos(state.facing);
        const norm = Math.hypot(dirX, dirZ) || 1;
        velocity.x = (dirX / norm) * config.dashSpeed;
        velocity.z = (dirZ / norm) * config.dashSpeed;
        velocity.y = Math.max(velocity.y, state.grounded ? 2 : 1);
        events.dashed = true;
    }

    const dashing = state.dashTimer > 0;
    state.dashTimer = Math.max(0, state.dashTimer - dt);

    // Horizontal acceleration towards the desired velocity.
    if (!dashing) {
        const targetX = inputX * config.maxSpeed;
        const targetZ = inputZ * config.maxSpeed;
        const rate = (inputLength > 0.05 ? config.acceleration : config.deceleration) * (state.grounded ? 1 : config.airControl);
        const deltaX = targetX - velocity.x;
        const deltaZ = targetZ - velocity.z;
        const deltaLength = Math.hypot(deltaX, deltaZ);
        const maxChange = rate * dt;

        if (deltaLength <= maxChange) {
            velocity.x = targetX;
            velocity.z = targetZ;
        } else {
            velocity.x += (deltaX / deltaLength) * maxChange;
            velocity.z += (deltaZ / deltaLength) * maxChange;
        }
    }

    // Jump with coyote time and input buffering for forgiving controls.
    state.coyoteTimer = state.grounded ? config.coyoteTime : Math.max(0, state.coyoteTimer - dt);
    state.jumpBufferTimer = input.jumpPressed ? config.jumpBufferTime : Math.max(0, state.jumpBufferTimer - dt);

    if (state.jumpBufferTimer > 0 && state.coyoteTimer > 0) {
        velocity.y = config.jumpVelocity;
        state.grounded = false;
        state.coyoteTimer = 0;
        state.jumpBufferTimer = 0;
        events.jumped = true;
    }

    // Snappier arcs: heavier when falling, short hop when jump is released.
    let gravity = config.gravity;
    if (velocity.y < 0) {
        gravity *= config.fallGravityMultiplier;
    } else if (!input.jumpHeld) {
        gravity *= config.lowJumpGravityMultiplier;
    }
    if (dashing) {
        gravity *= 0.4;
    }

    if (!state.grounded) {
        velocity.y = Math.max(velocity.y - gravity * dt, -config.maxFallSpeed);
    }

    // Horizontal move, then slide along walls.
    const beforeX = position.x + velocity.x * dt;
    const beforeZ = position.z + velocity.z * dt;
    position.x = beforeX;
    position.z = beforeZ;
    world.resolveWalls(position, config.radius, config.height, config.stepHeight);

    const pushX = position.x - beforeX;
    const pushZ = position.z - beforeZ;
    const pushLength = Math.hypot(pushX, pushZ);
    if (pushLength > 1e-6) {
        const normalX = pushX / pushLength;
        const normalZ = pushZ / pushLength;
        const into = velocity.x * normalX + velocity.z * normalZ;
        if (into < 0) {
            velocity.x -= normalX * into;
            velocity.z -= normalZ * into;
        }
    }

    // Vertical move and ground detection.
    const wasGrounded = state.grounded;
    const ground = world.groundHeight(position.x, position.z, position.y + config.stepHeight, config.radius * FOOT_RATIO);
    const nextY = position.y + velocity.y * dt;

    if (ground !== null && velocity.y <= 0 && (nextY <= ground || (wasGrounded && position.y - ground <= config.stepHeight))) {
        if (!wasGrounded) {
            events.landed = true;
            events.landingSpeed = -velocity.y;
        }
        position.y = ground;
        velocity.y = 0;
        state.grounded = true;
    } else {
        position.y = nextY;
        state.grounded = false;
    }

    return events;
}

function shortestAngle(from: number, to: number): number {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) {
        delta -= Math.PI * 2;
    }
    if (delta < -Math.PI) {
        delta += Math.PI * 2;
    }

    return delta;
}
