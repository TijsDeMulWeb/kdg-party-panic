/** Arcade kart handling. Pure, so it is easy to tune. */

export interface KartState {
    x: number;
    z: number;
    /** Yaw; 0 drives towards +z. */
    heading: number;
    speed: number;
    boost: number;
}

export interface KartInput {
    throttle: number;
    steer: number;
}

const ACCELERATION = 15;
const BRAKE = 26;
const REVERSE_ACCELERATION = 8;
const MAX_REVERSE = -5;
const COAST = 4;
const TURN_RATE = 2.3;
export const TRACK_SPEED = 17;
export const GRASS_SPEED = 7.5;
export const BOOST_SPEED = 25;

export function stepKart(kart: KartState, input: KartInput, onTrack: boolean, dt: number): void {
    kart.boost = Math.max(0, kart.boost - dt);
    const limit = kart.boost > 0 ? BOOST_SPEED : onTrack ? TRACK_SPEED : GRASS_SPEED;

    if (kart.boost > 0) {
        kart.speed = Math.min(BOOST_SPEED, kart.speed + ACCELERATION * 3 * dt);
    } else if (input.throttle > 0.1) {
        kart.speed += ACCELERATION * input.throttle * dt;
    } else if (input.throttle < -0.1) {
        kart.speed -= (kart.speed > 0 ? BRAKE : REVERSE_ACCELERATION) * -input.throttle * dt;
    } else {
        kart.speed -= Math.sign(kart.speed) * Math.min(Math.abs(kart.speed), COAST * dt);
    }

    // Too fast for the surface (grass, end of a boost): bleed speed quickly but not instantly.
    if (kart.speed > limit) {
        kart.speed = Math.max(limit, kart.speed - 18 * dt);
    }
    kart.speed = Math.max(MAX_REVERSE, kart.speed);

    const grip = Math.min(1, Math.abs(kart.speed) / 6);
    kart.heading -= input.steer * TURN_RATE * grip * Math.sign(kart.speed || 1) * dt;

    kart.x += Math.sin(kart.heading) * kart.speed * dt;
    kart.z += Math.cos(kart.heading) * kart.speed * dt;
}
