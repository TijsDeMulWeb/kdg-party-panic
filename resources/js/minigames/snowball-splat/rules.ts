import { SeededRandom } from '../../utils/random';

/** Pure Snowball Splat rules: arena walls, snowman pop-ups and scoring. */

export const DURATION = 30;
export const HALF_SIZE = 9;
export const SNOWMAN_POINTS = 50;
export const PLAYER_HIT_POINTS = 100;
export const SNOWMAN_LIFETIME = 4;
export const MAX_AMMO = 3;
export const RELOAD_TIME = 0.9;
export const FREEZE_TIME = 1.2;
export const THROW_SPEED = 18;
export const GRAVITY = 14;

export interface WallPlan {
    x: number;
    z: number;
    width: number;
    depth: number;
}

export interface SnowmanPlan {
    id: number;
    spawnAt: number;
    x: number;
    z: number;
}

/** Mirror-symmetric cover so no side has an advantage. */
export function planWalls(seed: number): WallPlan[] {
    const random = new SeededRandom(seed);
    const walls: WallPlan[] = [{ x: 0, z: 0, width: 3, depth: 0.9 }];

    for (let index = 0; index < 3; index++) {
        const x = 2.5 + random.next() * 4.5;
        const z = (random.next() * 2 - 1) * 6;
        const horizontal = random.next() < 0.5;
        const wall = { x, z, width: horizontal ? 2.8 : 0.9, depth: horizontal ? 0.9 : 2.8 };
        walls.push(wall, { ...wall, x: -x, z: -z });
    }

    return walls;
}

function insideWall(walls: readonly WallPlan[], x: number, z: number, margin: number): boolean {
    return walls.some((wall) => Math.abs(x - wall.x) < wall.width / 2 + margin && Math.abs(z - wall.z) < wall.depth / 2 + margin);
}

export function planSnowmen(seed: number, walls: readonly WallPlan[]): SnowmanPlan[] {
    const random = new SeededRandom(seed ^ 0x7f4a7c15);
    const snowmen: SnowmanPlan[] = [];

    for (let time = 1; time < DURATION - 1.5; time += 0.9 + random.next() * 0.8) {
        let x = 0;
        let z = 0;

        do {
            x = (random.next() * 2 - 1) * (HALF_SIZE - 1.2);
            z = (random.next() * 2 - 1) * (HALF_SIZE - 1.2);
        } while (insideWall(walls, x, z, 1));

        snowmen.push({ id: snowmen.length, spawnAt: time, x, z });
    }

    return snowmen;
}

export const MAX_SCORE = 3000;
