import { SeededRandom } from '../../utils/random';

/** Pure Quick Draw rules: when each duel's signal fires, and how reactions score. */

export const DURATION = 30;
/** No press within this window after the signal counts as a miss. */
export const RESPONSE_WINDOW = 1.2;
export const BEST_POINTS = 150;

export interface DuelPlan {
    index: number;
    /** "Ready…" appears. */
    readyAt: number;
    /** The signal fires: press now. */
    signalAt: number;
    /** Some duels show a fake-out flash first to catch twitchy fingers. */
    fakeAt: number | null;
}

export function planDuels(seed: number): DuelPlan[] {
    const random = new SeededRandom(seed);
    const duels: DuelPlan[] = [];
    let time = 1;

    while (true) {
        const wait = 1.3 + random.next() * 2.4;
        const signalAt = time + wait;

        if (signalAt + RESPONSE_WINDOW + 0.5 > DURATION) {
            break;
        }

        const fake = duels.length >= 2 && random.next() < 0.35;
        duels.push({ index: duels.length, readyAt: time, signalAt, fakeAt: fake ? time + wait * (0.35 + random.next() * 0.3) : null });
        time = signalAt + RESPONSE_WINDOW + 0.9;
    }

    return duels;
}

/** Faster is better: 150 points for an instant press, down to 10 at the end of the window. */
export function reactionPoints(reaction: number): number {
    const fraction = Math.min(1, Math.max(0, reaction / RESPONSE_WINDOW));

    return Math.max(10, Math.round(BEST_POINTS - fraction * (BEST_POINTS - 10) * 1.4));
}

export function maxScore(duels: readonly DuelPlan[]): number {
    return duels.length * BEST_POINTS;
}
