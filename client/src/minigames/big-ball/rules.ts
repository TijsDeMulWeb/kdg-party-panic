import { SeededRandom } from '../../utils/random';

/** Pure Big Ball rules: the obstacle course for a seed and how runs score. */

export const DURATION = 35;
export const COURSE_LENGTH = 64;
export const HALF_WIDTH = 6;
export const BALL_RADIUS = 1.2;
export const FINISH_BONUS = 1000;
export const POINTS_PER_SECOND_LEFT = 100;
export const PROGRESS_POINTS = 900;

export type Obstacle =
    | { kind: 'box'; x: number; z: number; width: number; depth: number; height: number; color: number }
    | { kind: 'bumper'; x: number; z: number; radius: number };

/** Paint indices into the party palette, assigned per obstacle. */
const COLORS = [0, 1, 2, 3, 4, 5];

/**
 * Rows of obstacles between start and finish. Every row leaves at least
 * one gap wider than the ball, so the course can always be completed.
 */
export function planCourse(seed: number): Obstacle[] {
    const random = new SeededRandom(seed);
    const obstacles: Obstacle[] = [];
    const rowKinds = ['wall', 'bumpers', 'blocks'] as const;
    let previousKind = '';

    for (let z = -12; z > -COURSE_LENGTH + 6; z -= 8) {
        let kind: (typeof rowKinds)[number] = random.pick(rowKinds);
        if (kind === previousKind) {
            kind = rowKinds[(rowKinds.indexOf(kind) + 1) % rowKinds.length];
        }
        previousKind = kind;

        if (kind === 'wall') {
            obstacles.push(...wallWithGaps(z, random));
        }

        if (kind === 'bumpers') {
            const offset = random.next() < 0.5 ? 0 : 2;
            for (const x of [-4 + offset, 0 + offset, 4 + offset]) {
                if (Math.abs(x) < HALF_WIDTH - 0.6) {
                    obstacles.push({ kind: 'bumper', x, z: z + (random.next() - 0.5) * 1.5, radius: 0.6 });
                }
            }
        }

        if (kind === 'blocks') {
            const side = random.next() < 0.5 ? -1 : 1;
            obstacles.push({ kind: 'box', x: side * 3.4, z, width: 4.4, depth: 1.2, height: 1.2, color: random.pick(COLORS) });
            obstacles.push({ kind: 'box', x: -side * 3.8, z: z - 3.5, width: 3.6, depth: 1.2, height: 1.2, color: random.pick(COLORS) });
        }
    }

    return obstacles;
}

/** A wall across the track with one or two gaps of 4 m. */
function wallWithGaps(z: number, random: SeededRandom): Obstacle[] {
    const gapWidth = 4;
    const gapCount = random.next() < 0.5 ? 1 : 2;
    const gaps = gapCount === 1 ? [-HALF_WIDTH + 1 + random.next() * (HALF_WIDTH * 2 - gapWidth - 2)] : [-HALF_WIDTH + 0.5, HALF_WIDTH - gapWidth - 0.5].map((start) => start + (random.next() - 0.5) * 0.8);
    const color = random.pick(COLORS);
    const segments: Obstacle[] = [];
    let cursor = -HALF_WIDTH;

    for (const start of gaps.sort((a, b) => a - b)) {
        if (start - cursor > 0.3) {
            segments.push({ kind: 'box', x: (cursor + start) / 2, z, width: start - cursor, depth: 0.8, height: 1, color });
        }
        cursor = start + gapWidth;
    }

    if (HALF_WIDTH - cursor > 0.3) {
        segments.push({ kind: 'box', x: (cursor + HALF_WIDTH) / 2, z, width: HALF_WIDTH - cursor, depth: 0.8, height: 1, color });
    }

    return segments;
}

/** Fraction of the course covered (0 at the start line, 1 at the finish). */
export function progressAt(ballZ: number): number {
    return Math.min(1, Math.max(0, -ballZ / COURSE_LENGTH));
}

export function scoreFor(progress: number, finishTime: number | null): number {
    if (finishTime !== null) {
        return FINISH_BONUS + Math.round(Math.max(0, DURATION - finishTime) * POINTS_PER_SECOND_LEFT);
    }

    return Math.round(progress * PROGRESS_POINTS);
}
