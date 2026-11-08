import { findCharacter } from '../characters/roster';
import type { MinigameNetwork } from '../minigames/types';
import type { PartySession } from './PartySession';

/** Adapts a party session to the small interface minigames understand. */
export function createMinigameNetwork(session: PartySession): MinigameNetwork {
    const remotePlayers = session.room.players
        .filter((player) => player.id !== session.player.id)
        .map((player) => ({ id: player.id, name: player.name, seat: player.seat, character: findCharacter(player.character) }));

    return {
        localSeat: session.me?.seat ?? 0,
        remotePlayers,
        serverNow: () => session.clock.now(),
        send: (snapshot) => session.sendSnapshot(snapshot),
        onSnapshot: (listener) => session.events.on('snapshot', ({ playerId, snapshot }) => listener(playerId, snapshot)),
        onPresence: (listener) => session.events.on('presence', listener),
        isOnline: (playerId) => session.online.has(playerId),
    };
}
