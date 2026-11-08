/** Pure Bumper Sumo rules: the shrinking ring, the sweeper bar, scoring. */

export const DURATION = 30;
export const START_RADIUS = 9;
export const END_RADIUS = 4.2;
export const SHRINK_FROM = 6;
export const SWEEPER_FROM = 3;
export const POINTS_PER_SECOND = 30;
export const SURVIVOR_BONUS = 200;
export const MAX_SCORE = DURATION * POINTS_PER_SECOND + SURVIVOR_BONUS;

export function arenaRadius(time: number): number {
    const progress = Math.min(1, Math.max(0, (time - SHRINK_FROM) / (DURATION - SHRINK_FROM - 2)));

    return START_RADIUS + (END_RADIUS - START_RADIUS) * progress;
}

/** Angle of the sweeper bar: it spins faster and faster. */
export function sweeperAngle(time: number): number {
    const active = Math.max(0, time - SWEEPER_FROM);

    return active * 0.9 + active * active * 0.022;
}

export function scoreFor(survived: number, lastedToEnd: boolean): number {
    return Math.round(survived * POINTS_PER_SECOND) + (lastedToEnd ? SURVIVOR_BONUS : 0);
}
