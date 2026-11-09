import { SeededRandom } from '../../utils/random';

/** Pure Fruit Frenzy rules: what falls where and when, and what it is worth. */

export const DURATION = 30;
export const HALF_SIZE = 8;
export const FALL_TIME = 1.3;
export const CATCH_RADIUS = 1.15;

export type FruitKind = 'apple' | 'pear' | 'golden' | 'rotten';

export const FRUIT_POINTS: Record<FruitKind, number> = {
    apple: 10,
    pear: 20,
    golden: 50,
    rotten: -30,
};

export interface FruitPlan {
    id: number;
    kind: FruitKind;
    /** Moment it lands (or gets caught). It appears FALL_TIME earlier. */
    landsAt: number;
    x: number;
    z: number;
}

export function planFruit(seed: number): FruitPlan[] {
    const random = new SeededRandom(seed);
    const fruit: FruitPlan[] = [];
    let time = 1 + FALL_TIME;

    while (time < DURATION - 0.2) {
        const roll = random.next();
        const kind: FruitKind = roll < 0.55 ? 'apple' : roll < 0.8 ? 'pear' : roll < 0.88 ? 'golden' : 'rotten';

        fruit.push({
            id: fruit.length,
            kind,
            landsAt: time,
            x: (random.next() * 2 - 1) * (HALF_SIZE - 1),
            z: (random.next() * 2 - 1) * (HALF_SIZE - 1),
        });

        time += Math.max(0.24, 0.6 - (time / DURATION) * 0.36) * (0.7 + random.next() * 0.6);
    }

    return fruit;
}

export function maxScore(fruit: readonly FruitPlan[]): number {
    return fruit.reduce((total, item) => total + Math.max(0, FRUIT_POINTS[item.kind]), 0);
}
