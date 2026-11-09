/** Pure Ice Slide rules: rink layout, ice friction and how close is close enough. */

export const DURATION = 35;
export const RINK_HALF_WIDTH = 5;
export const START_DEPTH = 7;
export const TARGET_Z = -22;
export const RINK_END_Z = -33;
/** Sliding deceleration on ice, m/s². */
export const ICE_FRICTION = 1.25;
export const RUN_MAX_SPEED = 9.5;

/** Rings from the centre outwards: radius and points. */
export const RINGS = [
    { radius: 0.7, points: 150, label: 'Bullseye!' },
    { radius: 1.6, points: 100, label: 'Great!' },
    { radius: 2.6, points: 60, label: 'Nice!' },
    { radius: 3.6, points: 30, label: 'On the board' },
];

export function pointsFor(distanceToCenter: number): { points: number; label: string } {
    const ring = RINGS.find((candidate) => distanceToCenter <= candidate.radius);

    return ring ? { points: ring.points, label: ring.label } : { points: 0, label: 'Missed!' };
}

/** Release speed that stops exactly on the bullseye from the throw line. */
export const IDEAL_SPEED = Math.sqrt(2 * ICE_FRICTION * -TARGET_Z);

export const MAX_SCORE = 10 * RINGS[0].points;
