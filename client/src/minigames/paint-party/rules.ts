import { SeededRandom } from '../../utils/random';

/** Pure Paint Party rules: grid, the rollers that wipe paint, scoring. */

export const DURATION = 30;
export const GRID = 12;
export const TILE = 1.7;
export const POINTS_PER_TILE = 10;
export const HALF = (GRID * TILE) / 2;
export const ROLLER_START = 3;

export interface RollerPlan {
    horizontal: boolean;
    speed: number;
    /** Lane (row or column) for each pass across the grid. */
    lanes: number[];
}

export function planRollers(seed: number): RollerPlan[] {
    const random = new SeededRandom(seed);

    return [true, false].map((horizontal) => ({
        horizontal,
        speed: 3.4 + random.next() * 0.6,
        lanes: Array.from({ length: 40 }, () => random.int(GRID)),
    }));
}

export interface RollerPosition {
    x: number;
    z: number;
    horizontal: boolean;
    /** Direction of travel along its axis: 1 or -1. */
    direction: number;
}

/** Where a roller is at `time`: it sweeps one lane, then switches lanes and sweeps back. */
export function rollerAt(plan: RollerPlan, time: number): RollerPosition | null {
    if (time < ROLLER_START) {
        return null;
    }

    const length = GRID * TILE + 2;
    const travelled = (time - ROLLER_START) * plan.speed * (1 + Math.min(1, time / DURATION) * 0.4);
    const pass = Math.floor(travelled / length);
    const along = travelled % length;
    const direction = pass % 2 === 0 ? 1 : -1;
    const offset = direction > 0 ? -HALF - 1 + along : HALF + 1 - along;
    const lane = plan.lanes[pass % plan.lanes.length];
    const across = -HALF + (lane + 0.5) * TILE;

    return plan.horizontal ? { x: offset, z: across, horizontal: true, direction } : { x: across, z: offset, horizontal: false, direction };
}

export function tileAt(x: number, z: number): number | null {
    const column = Math.floor((x + HALF) / TILE);
    const row = Math.floor((z + HALF) / TILE);

    if (column < 0 || column >= GRID || row < 0 || row >= GRID) {
        return null;
    }

    return row * GRID + column;
}

export function tileCenter(index: number): { x: number; z: number } {
    return { x: -HALF + ((index % GRID) + 0.5) * TILE, z: -HALF + (Math.floor(index / GRID) + 0.5) * TILE };
}

export const MAX_SCORE = GRID * GRID * POINTS_PER_TILE;
