import { apiRequest } from './api';
import type { MatchInfo, Player, RoomState, RoundOutcome } from './types';

interface Wrapped<T> {
    data: T;
}

export async function fetchCurrentPlayer(): Promise<Player | null> {
    return (await apiRequest<Wrapped<Player | null>>('GET', '/api/me')).data;
}

/** Creates a guest session, or updates the existing guest's name and character. */
export async function savePlayer(name: string, character: string, hat: string | null = null): Promise<Player> {
    const current = await fetchCurrentPlayer();

    if (current) {
        return (await apiRequest<Wrapped<Player>>('PATCH', '/api/me', { name, character, hat })).data;
    }

    const player = (await apiRequest<Wrapped<Player>>('POST', '/api/players', { name, character })).data;

    return hat ? (await apiRequest<Wrapped<Player>>('PATCH', '/api/me', { hat })).data : player;
}

export async function updateHat(hat: string | null): Promise<Player> {
    return (await apiRequest<Wrapped<Player>>('PATCH', '/api/me', { hat })).data;
}

export async function createRoom(): Promise<RoomState> {
    return (await apiRequest<Wrapped<RoomState>>('POST', '/api/rooms')).data;
}

export async function fetchRoom(code: string): Promise<RoomState> {
    return (await apiRequest<Wrapped<RoomState>>('GET', `/api/rooms/${code}`)).data;
}

export async function joinRoom(code: string): Promise<RoomState> {
    return (await apiRequest<Wrapped<RoomState>>('POST', `/api/rooms/${code}/memberships`)).data;
}

export async function updateMembership(code: string, changes: { is_ready?: boolean; character?: string }): Promise<RoomState> {
    return (await apiRequest<Wrapped<RoomState>>('PATCH', `/api/rooms/${code}/memberships`, changes)).data;
}

export async function leaveRoom(code: string): Promise<void> {
    await apiRequest<void>('DELETE', `/api/rooms/${code}/memberships`);
}

export async function startMatch(code: string): Promise<MatchInfo> {
    return (await apiRequest<Wrapped<MatchInfo>>('POST', `/api/rooms/${code}/matches`)).data;
}

export async function submitRoundResult(roundId: number, score: number): Promise<RoundOutcome> {
    return (await apiRequest<Wrapped<RoundOutcome>>('POST', `/api/rounds/${roundId}/results`, { score })).data;
}

export async function finalizeRound(roundId: number): Promise<RoundOutcome> {
    return (await apiRequest<Wrapped<RoundOutcome>>('POST', `/api/rounds/${roundId}/finalization`)).data;
}

export async function fetchRoundOutcome(roundId: number): Promise<RoundOutcome> {
    return (await apiRequest<Wrapped<RoundOutcome>>('GET', `/api/rounds/${roundId}/results`)).data;
}
