import type { MinigameNetwork } from '../minigames/types';

interface Claim {
    id: number;
    playerId: number;
    time: number;
}

/** How long a claim is repeated in snapshots so every client receives it. */
const BROADCAST_MS = 2500;

/**
 * Agreement on who grabbed something first (a toy, a star, a fruit)
 * without a server round trip. Claims ride along in movement snapshots;
 * every client applies the same rule: earliest server time wins, ties go
 * to the lowest player id. Works offline too (single player).
 */
export class ClaimBook {
    private readonly claims = new Map<number, Claim>();
    private readonly unsubscribe: (() => void) | null = null;

    constructor(
        private readonly network: MinigameNetwork | undefined,
        private readonly localTime: () => number,
        /** Something was taken by someone else; `wasMine` means we lose it. */
        private readonly onLost: (id: number, wasMine: boolean) => void,
        /** False when the game unpacks snapshots itself and calls receiveFrom(). */
        listen = true,
    ) {
        if (network && listen) {
            this.unsubscribe = network.onSnapshot((playerId, snapshot) => this.receive(playerId, snapshot.e));
        }
    }

    /** Feeds claims that arrived inside a game's own packed snapshot data. */
    receiveFrom(playerId: number, payload: number[] | undefined): void {
        this.receive(playerId, payload);
    }

    get myId(): number {
        return this.network?.localPlayerId ?? 0;
    }

    isClaimed(id: number): boolean {
        return this.claims.has(id);
    }

    /** Records a local grab. Returns false if someone already has it. */
    claim(id: number): boolean {
        if (this.claims.has(id)) {
            return false;
        }

        this.claims.set(id, { id, playerId: this.myId, time: this.now() });
        return true;
    }

    /** Recent local claims as [id, time, ...] for the snapshot's `e` field. */
    payload(): number[] {
        const now = this.now();
        const payload: number[] = [];

        for (const claim of this.claims.values()) {
            if (claim.playerId === this.myId && now - claim.time < BROADCAST_MS) {
                payload.push(claim.id, claim.time);
            }
        }

        return payload;
    }

    dispose(): void {
        this.unsubscribe?.();
    }

    private now(): number {
        return this.network ? this.network.serverNow() : this.localTime() * 1000;
    }

    private receive(playerId: number, payload: number[] | undefined): void {
        if (!payload) {
            return;
        }

        for (let index = 0; index + 1 < payload.length; index += 2) {
            const id = payload[index];
            const time = payload[index + 1];
            const existing = this.claims.get(id);

            if (existing) {
                if (existing.playerId === playerId) {
                    continue;
                }

                const remoteWins = time !== existing.time ? time < existing.time : playerId < existing.playerId;

                if (!remoteWins) {
                    continue;
                }
            }

            this.claims.set(id, { id, playerId, time });
            this.onLost(id, existing?.playerId === this.myId);
        }
    }
}
