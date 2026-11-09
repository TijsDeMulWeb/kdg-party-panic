import { SeededRandom } from '../../utils/random';

/** Pure Vacuum Chaos rules: which toys appear where and when, and what they are worth. */

export const DURATION = 30;
export const ARENA_RADIUS = 12;

export type ToyKind = 'small' | 'medium' | 'large';

export interface ToyType {
    kind: ToyKind;
    points: number;
    /** Seconds of continuous suction needed once the toy reaches the nozzle. */
    suckTime: number;
    /** How fast the suction drags it in (m/s at full strength). */
    pullSpeed: number;
    /** Movement speed multiplier while sucking this toy. */
    slowdown: number;
}

export const TOY_TYPES: Record<ToyKind, ToyType> = {
    small: { kind: 'small', points: 10, suckTime: 0, pullSpeed: 7, slowdown: 1 },
    medium: { kind: 'medium', points: 25, suckTime: 0.5, pullSpeed: 4, slowdown: 0.8 },
    large: { kind: 'large', points: 60, suckTime: 1.4, pullSpeed: 1.8, slowdown: 0.45 },
};

export interface ToyPlan {
    id: number;
    kind: ToyKind;
    /** Variant for visual variety (block, ball, duck, car, bear). */
    variant: number;
    color: number;
    x: number;
    z: number;
    spawnAt: number;
}

const WAVE_TIMES = [0, 6, 12, 18, 24];

/** Toys arrive in waves so the arena never runs dry. */
export function planToys(seed: number): ToyPlan[] {
    const random = new SeededRandom(seed);
    const toys: ToyPlan[] = [];

    WAVE_TIMES.forEach((time, wave) => {
        const count = wave === 0 ? 34 : 12;

        for (let index = 0; index < count; index++) {
            const roll = random.next();
            const kind: ToyKind = roll < 0.6 ? 'small' : roll < 0.88 ? 'medium' : 'large';
            const angle = random.next() * Math.PI * 2;
            const distance = Math.sqrt(random.next()) * (ARENA_RADIUS - 1.5);

            toys.push({
                id: toys.length,
                kind,
                variant: random.int(2),
                color: random.int(6),
                x: Math.cos(angle) * distance,
                z: Math.sin(angle) * distance,
                spawnAt: time + (wave === 0 ? 0 : random.next() * 1.5),
            });
        }
    });

    return toys;
}

export function maxScore(toys: readonly ToyPlan[]): number {
    return toys.reduce((total, toy) => total + TOY_TYPES[toy.kind].points, 0);
}

/**
 * Two players can grab the same toy at almost the same moment. Everyone
 * applies the same rule, so all clients agree: the earliest claim (server
 * time) wins, ties go to the lowest player id.
 */
export function claimWins(time: number, playerId: number, otherTime: number, otherPlayerId: number): boolean {
    if (time !== otherTime) {
        return time < otherTime;
    }

    return playerId < otherPlayerId;
}
