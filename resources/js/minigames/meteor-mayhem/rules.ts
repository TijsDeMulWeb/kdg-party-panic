import { SeededRandom } from '../../utils/random';

/** Pure Meteor Mayhem rules: when and where meteors land, where stars appear. */

export const DURATION = 30;
export const ARENA_RADIUS = 10;
export const METEOR_RADIUS = 1.8;
export const WARNING_TIME = 1.3;
export const STAR_POINTS = 50;
export const HIT_PENALTY = 50;
export const STAR_LIFETIME = 6;

export interface MeteorPlan {
    id: number;
    /** Impact time; the shadow appears WARNING_TIME before. */
    impactAt: number;
    x: number;
    z: number;
}

export interface StarPlan {
    id: number;
    spawnAt: number;
    x: number;
    z: number;
}

function pointInArena(random: SeededRandom, margin: number): { x: number; z: number } {
    const angle = random.next() * Math.PI * 2;
    const distance = Math.sqrt(random.next()) * (ARENA_RADIUS - margin);

    return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
}

/** Meteors come faster and faster: from one every 0.9 s down to one every 0.3 s. */
export function planMeteors(seed: number): MeteorPlan[] {
    const random = new SeededRandom(seed);
    const meteors: MeteorPlan[] = [];
    let time = 1.5 + WARNING_TIME;

    while (time < DURATION) {
        meteors.push({ id: meteors.length, impactAt: time, ...pointInArena(random, 0.5) });
        time += Math.max(0.3, 0.9 - (time / DURATION) * 0.6) * (0.75 + random.next() * 0.5);
    }

    return meteors;
}

export function planStars(seed: number): StarPlan[] {
    const random = new SeededRandom(seed ^ 0x2545f491);
    const stars: StarPlan[] = [];

    for (let time = 0.5; time < DURATION - 1; time += 1.1 + random.next() * 0.4) {
        stars.push({ id: stars.length, spawnAt: time, ...pointInArena(random, 1.2) });
    }

    return stars;
}

export const MAX_SCORE = 30 * STAR_POINTS;
