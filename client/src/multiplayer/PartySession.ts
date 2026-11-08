import type { PresenceChannel } from 'pusher-js';
import { readStorage, writeStorage } from '../utils/storage';
import { Emitter } from './emitter';
import * as partyApi from './partyApi';
import { realtime } from './realtime';
import { ServerClock } from './ServerClock';
import type { Player, PlayerSnapshot, RoomPlayer, RoomState, RoundInfo } from './types';

const ROOM_KEY = 'party-panic.room';

type SessionEvents = {
    room: RoomState;
    round: RoundInfo;
    presence: ReadonlySet<number>;
    snapshot: { playerId: number; snapshot: PlayerSnapshot };
    disconnected: undefined;
};

/**
 * One player's membership of a private party: REST calls to Laravel for
 * anything authoritative, a presence channel for who is online, room
 * updates and round starts, and client events for movement.
 * Lives across scenes (lobby → minigame → lobby).
 */
export class PartySession {
    readonly events = new Emitter<SessionEvents>();
    readonly clock = new ServerClock();
    private channel: PresenceChannel | null = null;
    private connected = new Set<number>();

    private constructor(
        readonly player: Player,
        private state: RoomState,
    ) {}

    static async create(player: Player): Promise<PartySession> {
        return PartySession.open(player, await partyApi.createRoom());
    }

    static async join(player: Player, code: string): Promise<PartySession> {
        return PartySession.open(player, await partyApi.joinRoom(code.trim().toUpperCase()));
    }

    /** Re-enters the room remembered from a previous visit, if still a member. */
    static async resume(): Promise<PartySession | null> {
        const code = readStorage(ROOM_KEY, '');

        if (!code) {
            return null;
        }

        const player = await partyApi.fetchCurrentPlayer();

        if (!player) {
            return null;
        }

        try {
            return await PartySession.open(player, await partyApi.fetchRoom(code));
        } catch {
            writeStorage(ROOM_KEY, '');
            return null;
        }
    }

    private static async open(player: Player, state: RoomState): Promise<PartySession> {
        const session = new PartySession(player, state);
        writeStorage(ROOM_KEY, state.code);
        await Promise.all([session.clock.sync(), session.subscribe()]);

        return session;
    }

    get room(): RoomState {
        return this.state;
    }

    get me(): RoomPlayer | undefined {
        return this.state.players.find((player) => player.id === this.player.id);
    }

    get isHost(): boolean {
        return this.state.host_id === this.player.id;
    }

    get online(): ReadonlySet<number> {
        return this.connected;
    }

    async setReady(isReady: boolean): Promise<void> {
        this.applyState(await partyApi.updateMembership(this.state.code, { is_ready: isReady }));
    }

    async setCharacter(character: string): Promise<void> {
        this.applyState(await partyApi.updateMembership(this.state.code, { character }));
    }

    async startRound(): Promise<void> {
        await partyApi.startRound(this.state.code);
    }

    async refresh(): Promise<void> {
        this.applyState(await partyApi.fetchRoom(this.state.code));
    }

    /** Broadcasts this player's movement to everyone else in the room. */
    sendSnapshot(snapshot: Omit<PlayerSnapshot, 'p'>): void {
        if (this.channel?.subscribed) {
            this.channel.trigger('client-snapshot', { ...snapshot, p: this.player.id });
        }
    }

    async leave(): Promise<void> {
        writeStorage(ROOM_KEY, '');
        this.close();
        await partyApi.leaveRoom(this.state.code).catch(() => undefined);
    }

    close(): void {
        if (this.channel) {
            realtime().unsubscribe(this.channel.name);
            this.channel = null;
        }
        this.events.clear();
    }

    private applyState(state: RoomState): void {
        this.state = state;
        this.events.emit('room', state);
    }

    private subscribe(): Promise<void> {
        const pusher = realtime();
        const channel = pusher.subscribe(`presence-room.${this.state.code}`) as PresenceChannel;
        this.channel = channel;

        channel.bind('room.updated', ({ room }: { room: RoomState }) => this.applyState(room));
        channel.bind('round.starting', ({ round }: { round: RoundInfo }) => this.events.emit('round', round));
        channel.bind('client-snapshot', (snapshot: PlayerSnapshot) => {
            this.events.emit('snapshot', { playerId: snapshot.p, snapshot });
        });

        channel.bind('pusher:member_added', (member: { id: string }) => {
            this.connected.add(Number(member.id));
            this.events.emit('presence', this.connected);
            // A (re)joining player may have changed the roster.
            void this.refresh().catch(() => undefined);
        });

        channel.bind('pusher:member_removed', (member: { id: string }) => {
            this.connected.delete(Number(member.id));
            this.events.emit('presence', this.connected);
        });

        pusher.connection.bind('state_change', ({ current }: { current: string }) => {
            if (current === 'unavailable' || current === 'failed') {
                this.events.emit('disconnected', undefined);
            }
        });

        return new Promise((resolve, reject) => {
            channel.bind('pusher:subscription_succeeded', (members: { each(callback: (member: { id: string }) => void): void }) => {
                this.connected = new Set();
                members.each((member) => this.connected.add(Number(member.id)));
                this.events.emit('presence', this.connected);
                resolve();
            });

            channel.bind('pusher:subscription_error', () => reject(new Error('Could not connect to the party channel.')));
        });
    }
}
