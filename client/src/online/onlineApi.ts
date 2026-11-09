import { apiRequest } from '../multiplayer/api';
import { fetchCurrentPlayer, savePlayer } from '../multiplayer/partyApi';
import type { Player } from '../multiplayer/types';
import { displayName, type LocalProfile } from './profile';

interface Wrapped<T> {
    data: T;
}

export interface RunInfo {
    id: number;
    minigame: string;
    seed: number;
    is_daily: boolean;
    is_official: boolean;
    score: number | null;
    rank?: number;
}

export interface LeaderboardEntry {
    rank: number;
    player_id: number;
    name: string;
    character: string | null;
    score: number;
    is_me: boolean;
}

export interface Leaderboard {
    title: string;
    entries: LeaderboardEntry[];
    me: LeaderboardEntry | null;
}

export interface DailyChallengeInfo {
    date: string;
    minigame: string;
    seed: number;
    official_score: number | null;
    attempts: number;
    rules: string;
    resets_at: number;
}

export interface MatchHistoryEntry {
    match_id: number;
    played_at: string | null;
    rank: number | null;
    points: number;
    character: string;
    players: number;
    winner: string | null;
}

/** Makes sure there is a (guest) session with the local profile's name and look. */
export async function ensureSession(profile: LocalProfile): Promise<Player> {
    const current = await fetchCurrentPlayer();

    if (current) {
        return current;
    }

    return savePlayer(displayName(profile), profile.character.id, profile.hat);
}

export async function syncProfile(profile: LocalProfile): Promise<Player | null> {
    const current = await fetchCurrentPlayer();

    if (!current) {
        return null;
    }

    return savePlayer(displayName(profile), profile.character.id, profile.hat);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([promise, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('The server took too long to answer.')), ms))]);
}

/** Starts a leaderboard run. Resolves to null when the backend is unreachable (offline play). */
export async function startRun(profile: LocalProfile, minigame: string): Promise<RunInfo | null> {
    try {
        await withTimeout(ensureSession(profile), 2500);
        return (await withTimeout(apiRequest<Wrapped<RunInfo>>('POST', `/api/minigames/${minigame}/runs`), 2500)).data;
    } catch {
        return null;
    }
}

export async function startDailyRun(profile: LocalProfile): Promise<RunInfo> {
    await ensureSession(profile);
    return (await apiRequest<Wrapped<RunInfo>>('POST', '/api/daily-challenge/runs')).data;
}

export async function submitRun(runId: number, score: number): Promise<RunInfo> {
    return (await apiRequest<Wrapped<RunInfo>>('PATCH', `/api/runs/${runId}`, { score })).data;
}

export async function fetchDailyChallenge(): Promise<DailyChallengeInfo> {
    return (await apiRequest<Wrapped<DailyChallengeInfo>>('GET', '/api/daily-challenge')).data;
}

export async function fetchLeaderboard(board: string): Promise<Leaderboard> {
    const path = board === 'daily' ? '/api/daily-challenge/leaderboard' : `/api/minigames/${board}/leaderboard`;
    return (await apiRequest<Wrapped<Leaderboard>>('GET', path)).data;
}

export async function fetchMatchHistory(): Promise<MatchHistoryEntry[]> {
    return (await apiRequest<Wrapped<MatchHistoryEntry[]>>('GET', '/api/me/matches')).data;
}

export async function register(name: string, email: string, password: string): Promise<Player> {
    return (await apiRequest<Wrapped<Player>>('POST', '/api/accounts', { name, email, password })).data;
}

export async function login(email: string, password: string): Promise<Player> {
    return (await apiRequest<Wrapped<Player>>('POST', '/api/session', { email, password })).data;
}

export async function logout(): Promise<void> {
    await apiRequest<void>('DELETE', '/api/session');
}
