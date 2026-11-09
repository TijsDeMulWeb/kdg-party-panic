/**
 * Small wrapper around localStorage that never throws.
 * Storage can be unavailable (private mode, blocked site data), so every
 * read falls back to a default value and every write is best effort.
 */
export function readStorage(key: string, fallback: string): string {
    try {
        return window.localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeStorage(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Ignore: persistence is a convenience only.
    }
}
