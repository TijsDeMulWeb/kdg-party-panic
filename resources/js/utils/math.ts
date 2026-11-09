export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing factor. */
export function damp(sharpness: number, dt: number): number {
    return 1 - Math.exp(-sharpness * dt);
}

/** Moves `current` towards `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
    if (current < target) {
        return Math.min(current + maxDelta, target);
    }

    return Math.max(current - maxDelta, target);
}

/** Shortest signed difference between two angles, in radians. */
export function angleDelta(from: number, to: number): number {
    let delta = (to - from) % (Math.PI * 2);

    if (delta > Math.PI) {
        delta -= Math.PI * 2;
    }

    if (delta < -Math.PI) {
        delta += Math.PI * 2;
    }

    return delta;
}

export function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

export function pick<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}
