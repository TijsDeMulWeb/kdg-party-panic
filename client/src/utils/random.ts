/**
 * Seeded pseudo-random generator (mulberry32). Minigames use this instead
 * of Math.random() for anything that affects gameplay, so every player in
 * a room (and every daily challenge attempt) gets the same layout.
 */
export class SeededRandom {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    /** Float in [0, 1). */
    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(maxExclusive: number): number {
        return Math.floor(this.next() * maxExclusive);
    }

    pick<T>(items: readonly T[]): T {
        return items[this.int(items.length)];
    }

    shuffle<T>(items: readonly T[]): T[] {
        const result = [...items];

        for (let index = result.length - 1; index > 0; index--) {
            const swap = this.int(index + 1);
            [result[index], result[swap]] = [result[swap], result[index]];
        }

        return result;
    }
}

export function randomSeed(): number {
    return Math.floor(Math.random() * 2 ** 32);
}
