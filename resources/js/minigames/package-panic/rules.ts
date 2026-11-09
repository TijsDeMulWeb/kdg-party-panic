import { SeededRandom } from '../../utils/random';

/**
 * Pure Package Panic rules: when packages appear, where, what colour,
 * which bin takes which colour, and how deliveries score.
 */

export const DURATION = 30;
export const LANE_COUNT = 3;
export const LANE_WIDTH = 2;
export const BELT_LENGTH = 12;
export const BASE_POINTS = 100;
export const COMBO_STEP = 10;
export const MAX_COMBO_BONUS_STEPS = 10;
/** Bins swap colours at these moments (seconds). */
export const BIN_SHUFFLE_TIMES = [0, 10, 20];
/** The three package colours, as indices into SYMBOL_COLORS (red, blue, yellow). */
export const PACKAGE_COLORS = [0, 1, 2];

export interface PackagePlan {
    id: number;
    spawnAt: number;
    /** Lane the package starts in. */
    lane: number;
    /** Index into SYMBOL_COLORS. */
    color: number;
}

export interface BinLayout {
    from: number;
    /** Colour per lane, left to right. */
    lanes: number[];
}

export function beltSpeed(time: number): number {
    return 2.2 + Math.min(1, time / DURATION) * 2;
}

function spawnInterval(time: number): number {
    return Math.max(0.85, 1.7 - (time / DURATION) * 0.9);
}

export function planBins(seed: number): BinLayout[] {
    const random = new SeededRandom(seed ^ 0x5bd1e995);
    let previous: number[] = [];

    return BIN_SHUFFLE_TIMES.map((from) => {
        let lanes = random.shuffle(PACKAGE_COLORS);

        // A shuffle that changes nothing would be a surprise nobody notices.
        while (previous.length && lanes.every((color, index) => color === previous[index])) {
            lanes = random.shuffle(PACKAGE_COLORS);
        }

        previous = lanes;

        return { from, lanes };
    });
}

export function binsAt(bins: readonly BinLayout[], time: number): number[] {
    let current = bins[0];

    for (const layout of bins) {
        if (time >= layout.from) {
            current = layout;
        }
    }

    return current.lanes;
}

/** Packages that can still reach the end of the belt before time runs out. */
export function planPackages(seed: number): PackagePlan[] {
    const random = new SeededRandom(seed);
    const plans: PackagePlan[] = [];
    let time = 0.6;

    while (time + travelTime(time) < DURATION) {
        plans.push({
            id: plans.length,
            spawnAt: time,
            lane: random.int(LANE_COUNT),
            color: random.pick(PACKAGE_COLORS),
        });
        time += spawnInterval(time) * (0.85 + random.next() * 0.3);
    }

    return plans;
}

/** How long a package spawned at `spawnAt` needs to reach the end of the belt. */
export function travelTime(spawnAt: number): number {
    let distance = 0;
    let time = spawnAt;
    const step = 0.05;

    while (distance < BELT_LENGTH) {
        distance += beltSpeed(time) * step;
        time += step;
    }

    return time - spawnAt;
}

export function deliveryPoints(combo: number): number {
    return BASE_POINTS + COMBO_STEP * Math.min(combo, MAX_COMBO_BONUS_STEPS);
}

/** Lane index (0..2) for an x position on the belt (belt centred on x = 0). */
export function laneAt(x: number): number {
    return Math.min(LANE_COUNT - 1, Math.max(0, Math.round(x / LANE_WIDTH) + 1));
}

export function laneCenter(lane: number): number {
    return (lane - 1) * LANE_WIDTH;
}

export function maxScore(packages: readonly PackagePlan[]): number {
    return packages.reduce((total, _, index) => total + deliveryPoints(index), 0);
}
