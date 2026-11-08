import { apiRequest } from './api';
import type { Player, RoomState, RoundInfo } from './types';

interface Wrapped<T> {
    data: T;
}

export async function fetchCurrentPlayer(): Promise<Player | null> {
    return (await apiRequest<Wrapped<Player | null>>('GET', '/api/me')).data;
}

/** Creates a guest session, or updates the existing guest's name and character. */
export async function savePlayer(name: string, character: string): Promise<Player> {
    const current = await fetchCurrentPlayer();

    if (current) {
        return (await apiRequest<Wrapped<Player>>('PATCH', '/api/me', { name, character })).data;
    }

    return (await apiRequest<Wrapped<Player>>('POST', '/api/players', { name, character })).data;
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

export async function startRound(code: string): Promise<RoundInfo> {
    return (await apiRequest<Wrapped<RoundInfo>>('POST', `/api/rooms/${code}/rounds`)).data;
}
