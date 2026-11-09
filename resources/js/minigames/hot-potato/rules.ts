import { SeededRandom } from '../../utils/random';

/** Pure Hot Potato rules: when the bomb goes off and who gets it first. */

export const DURATION = 30;
export const ARENA_RADIUS = 7.5;
export const SURVIVE_POINTS = 100;
export const LAST_STANDING_BONUS = 150;
export const PASS_POINTS = 10;
export const MAX_PASS_POINTS = 200;
/** After receiving the bomb you cannot pass it straight back. */
export const PASS_COOLDOWN = 0.6;

export interface FuseRound {
    index: number;
    /** The bomb appears with its first holder. */
    startsAt: number;
    explodesAt: number;
    /** Picks the first holder from the players still in (index into sorted ids). */
    firstHolderRoll: number;
}

export function planFuses(seed: number): FuseRound[] {
    const random = new SeededRandom(seed);
    const rounds: FuseRound[] = [];
    let time = 1;

    while (time + 6 < DURATION) {
        const fuse = 6.5 + random.next() * 3.5;
        rounds.push({ index: rounds.length, startsAt: time, explodesAt: Math.min(DURATION - 0.5, time + fuse), firstHolderRoll: random.next() });
        time += fuse + 1.8;
    }

    return rounds;
}

export function firstHolder(round: FuseRound, activeIds: readonly number[]): number | null {
    if (activeIds.length === 0) {
        return null;
    }

    const sorted = [...activeIds].sort((a, b) => a - b);

    return sorted[Math.floor(round.firstHolderRoll * sorted.length)];
}

export const MAX_SCORE = 4 * SURVIVE_POINTS + LAST_STANDING_BONUS + MAX_PASS_POINTS;
