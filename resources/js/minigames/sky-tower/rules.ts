import { SeededRandom } from '../../utils/random';

/** Pure Sky Tower rules: the spiral of platforms, the rising goo, scoring. */

export const DURATION = 35;
export const PILLAR_RADIUS = 1.6;
export const BASE_RADIUS = 6.5;
export const POINTS_PER_METER = 20;
export const STAR_POINTS = 30;
export const GOO_START = 8;
export const GOO_SPEED = 0.58;

export interface PlatformPlan {
    id: number;
    x: number;
    y: number;
    z: number;
    radius: number;
    angle: number;
    hasStar: boolean;
}

/**
 * Platforms spiral up around a pillar. Each step is at most 1.4 m higher
 * and roughly 2.6 m further round, always within jumping reach.
 */
export function planTower(seed: number): PlatformPlan[] {
    const random = new SeededRandom(seed);
    const platforms: PlatformPlan[] = [];
    let angle = random.next() * Math.PI * 2;
    let y = 0;

    for (let id = 0; id < 46; id++) {
        y += 1.05 + random.next() * 0.35;
        const distance = 3.8 + random.next() * 1.4;
        angle += (2.3 + random.next() * 0.6) / distance;

        platforms.push({
            id,
            x: Math.sin(angle) * distance,
            y,
            z: Math.cos(angle) * distance,
            radius: id % 7 === 6 ? 1.6 : 1.15 + random.next() * 0.2,
            angle,
            hasStar: id % 3 === 2,
        });
    }

    return platforms;
}

export function gooHeight(time: number): number {
    return -1 + Math.max(0, time - GOO_START) * GOO_SPEED;
}

export function scoreFor(maxHeight: number, stars: number): number {
    return Math.round(maxHeight * POINTS_PER_METER) + stars * STAR_POINTS;
}
