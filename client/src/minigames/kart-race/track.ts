import { SeededRandom } from '../../utils/random';

/** Pure Mini Kart Race rules: the circuit, progress along it, boost pads and scoring. */

export const DURATION = 45;
export const LAPS = 2;
export const HALF_WIDTH = 3.6;
export const SAMPLES = 480;

const CONTROL_POINTS: [number, number][] = [
    [0, 0],
    [14, -2],
    [23, -12],
    [19, -27],
    [5, -31],
    [-6, -23],
    [-5, -13],
    [-17, -9],
    [-21, 3],
    [-11, 10],
];

export interface TrackPoint {
    x: number;
    z: number;
    /** Unit direction of travel. */
    dx: number;
    dz: number;
    /** Distance along the lap from the start line. */
    distance: number;
}

/** Closed Catmull-Rom spline through the control points, sampled evenly by parameter. */
export function buildTrack(): TrackPoint[] {
    const points: TrackPoint[] = [];
    const count = CONTROL_POINTS.length;

    for (let index = 0; index < SAMPLES; index++) {
        const t = (index / SAMPLES) * count;
        const segment = Math.floor(t);
        const local = t - segment;
        const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((offset) => CONTROL_POINTS[(segment + offset + count) % count]);
        const catmull = (a: number, b: number, c: number, d: number): number =>
            0.5 * (2 * b + (-a + c) * local + (2 * a - 5 * b + 4 * c - d) * local * local + (-a + 3 * b - 3 * c + d) * local * local * local);

        points.push({ x: catmull(p0[0], p1[0], p2[0], p3[0]), z: catmull(p0[1], p1[1], p2[1], p3[1]), dx: 0, dz: 0, distance: 0 });
    }

    let distance = 0;
    points.forEach((point, index) => {
        const next = points[(index + 1) % SAMPLES];
        const length = Math.hypot(next.x - point.x, next.z - point.z) || 1;
        point.dx = (next.x - point.x) / length;
        point.dz = (next.z - point.z) / length;
        point.distance = distance;
        distance += length;
    });

    return points;
}

export function lapLength(track: readonly TrackPoint[]): number {
    const last = track[track.length - 1];
    return last.distance + Math.hypot(track[0].x - last.x, track[0].z - last.z);
}

/** Closest sample near a previous guess (karts never jump far between frames). */
export function nearestSample(track: readonly TrackPoint[], x: number, z: number, guess: number, window = 40): { index: number; distance: number } {
    let best = guess;
    let bestDistance = Infinity;

    for (let offset = -window; offset <= window; offset++) {
        const index = (guess + offset + SAMPLES) % SAMPLES;
        const distance = Math.hypot(track[index].x - x, track[index].z - z);

        if (distance < bestDistance) {
            best = index;
            bestDistance = distance;
        }
    }

    return { index: best, distance: bestDistance };
}

export interface BoostPad {
    index: number;
    /** Sideways offset from the centre line. */
    offset: number;
}

export function planBoosts(seed: number): BoostPad[] {
    const random = new SeededRandom(seed);

    return [0.18, 0.42, 0.63, 0.86].map((fraction) => ({
        index: Math.floor((fraction + (random.next() - 0.5) * 0.06) * SAMPLES),
        offset: (random.next() * 2 - 1) * (HALF_WIDTH - 1.4),
    }));
}

export function scoreFor(lapsDone: number, lapFraction: number, finishTime: number | null): number {
    if (finishTime !== null) {
        return 1000 + Math.round(Math.max(0, DURATION - finishTime) * 40);
    }

    return Math.round(Math.min(1, (lapsDone + lapFraction) / LAPS) * 900);
}

export const MAX_SCORE = 2400;
