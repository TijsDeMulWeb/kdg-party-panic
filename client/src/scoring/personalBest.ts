import { readStorage, writeStorage } from '../utils/storage';

const PREFIX = 'party-panic.best.';

/** Local personal records for Solo Arcade. Global leaderboards come with the backend. */
export function getPersonalBest(minigameId: string): number | null {
    const stored = Number.parseInt(readStorage(PREFIX + minigameId, ''), 10);

    return Number.isFinite(stored) ? stored : null;
}

/** Saves the score if it beats the record. Returns true for a new record. */
export function submitPersonalBest(minigameId: string, score: number): boolean {
    const best = getPersonalBest(minigameId);

    if (best !== null && score <= best) {
        return false;
    }

    writeStorage(PREFIX + minigameId, String(score));

    return true;
}
