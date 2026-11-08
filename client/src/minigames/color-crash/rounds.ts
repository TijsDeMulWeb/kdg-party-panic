import { SeededRandom } from '../../utils/random';
import { CRASH_COLORS } from './colors';

/**
 * Pure Color Crash rules: round schedule, tile layouts and scoring.
 * No rendering, so the backend can reproduce a run from its seed and
 * reject impossible scores.
 */

export const GRID_SIZE = 7;
export const TILE_COUNT = GRID_SIZE * GRID_SIZE;
export const DURATION = 30;
export const ROUND_POINTS = 100;
export const MAX_REACTION_BONUS = 50;
export const FIRST_ROUND_DELAY = 0.4;
/** Long enough that jumping cannot bridge the gap until tiles return. */
export const DROP_TIME = 1;
export const RESTORE_TIME = 0.7;
export const WARNING_TIME = 0.6;

export interface RoundPlan {
    index: number;
    startsAt: number;
    chooseTime: number;
    dropAt: number;
    restoreAt: number;
    endsAt: number;
    /** Index into CRASH_COLORS. */
    target: number;
    /** Colour index per tile, row-major. */
    tiles: number[];
}

export function chooseTimeFor(round: number): number {
    return Math.max(1.4, 3.2 - round * 0.25);
}

function colorCountFor(round: number): number {
    if (round < 2) {
        return 3;
    }

    return round < 4 ? 4 : 5;
}

function targetCountFor(round: number): number {
    const fraction = Math.max(0.1, 0.3 - round * 0.03);

    return Math.max(4, Math.round(TILE_COUNT * fraction));
}

/** 3x3 sectors so target tiles are spread across the arena. */
function sectorOf(tile: number): number {
    const band = (value: number): number => (value < 2 ? 0 : value < 5 ? 1 : 2);
    const row = Math.floor(tile / GRID_SIZE);
    const column = tile % GRID_SIZE;

    return band(row) * 3 + band(column);
}

function layoutFor(round: number, target: number, random: SeededRandom): number[] {
    const others = random.shuffle(CRASH_COLORS.map((_, index) => index).filter((index) => index !== target)).slice(0, colorCountFor(round) - 1);
    const tiles = Array.from({ length: TILE_COUNT }, () => random.pick(others));
    const targetCount = targetCountFor(round);
    const chosen = new Set<number>();

    // One target per sector first, then the rest anywhere.
    for (const sector of random.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8])) {
        if (chosen.size >= targetCount) {
            break;
        }
        const candidates = tiles.map((_, tile) => tile).filter((tile) => sectorOf(tile) === sector);
        chosen.add(random.pick(candidates));
    }

    for (const tile of random.shuffle(tiles.map((_, index) => index))) {
        if (chosen.size >= targetCount) {
            break;
        }
        chosen.add(tile);
    }

    chosen.forEach((tile) => (tiles[tile] = target));

    return tiles;
}

export function planRounds(seed: number): RoundPlan[] {
    const random = new SeededRandom(seed);
    const plans: RoundPlan[] = [];
    let time = FIRST_ROUND_DELAY;
    let previousTarget = -1;

    for (let index = 0; ; index++) {
        const chooseTime = chooseTimeFor(index);
        const dropAt = time + chooseTime;
        const restoreAt = dropAt + DROP_TIME;

        if (restoreAt > DURATION) {
            break;
        }

        let target = random.int(CRASH_COLORS.length);
        if (target === previousTarget) {
            target = (target + 1 + random.int(CRASH_COLORS.length - 1)) % CRASH_COLORS.length;
        }
        previousTarget = target;

        plans.push({
            index,
            startsAt: time,
            chooseTime,
            dropAt,
            restoreAt,
            endsAt: restoreAt + RESTORE_TIME,
            target,
            tiles: layoutFor(index, target, random),
        });

        time = restoreAt + RESTORE_TIME;
    }

    return plans;
}

/** Bonus for reaching a safe tile early. `reaction` is seconds after the announcement. */
export function reactionBonus(reaction: number | null, chooseTime: number): number {
    if (reaction === null) {
        return 0;
    }

    const remaining = Math.min(1, Math.max(0, 1 - reaction / chooseTime));

    return Math.round(MAX_REACTION_BONUS * remaining);
}

export function maxScore(plans: readonly RoundPlan[]): number {
    return plans.length * (ROUND_POINTS + MAX_REACTION_BONUS);
}
