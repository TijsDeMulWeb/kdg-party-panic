/** Shapes returned by the Laravel API (see backend/app/Http/Resources). */

export interface Player {
    id: number;
    name: string;
    character: string | null;
    is_guest: boolean;
}

export interface RoomPlayer {
    id: number;
    name: string;
    seat: number;
    is_ready: boolean;
    character: string;
}

export interface RoundInfo {
    number: number;
    minigame: string;
    seed: number;
    /** Server time in milliseconds. */
    starts_at: number;
    ends_at: number;
}

export interface RoomState {
    code: string;
    host_id: number;
    max_players: number;
    min_players: number;
    active_round: RoundInfo | null;
    players: RoomPlayer[];
}

/**
 * Compact movement state sent between clients as a Pusher client event
 * (~9 per second). Keys are short to keep messages small.
 */
export interface PlayerSnapshot {
    /** Sender's player id. */
    p: number;
    /** Sender's server-synchronised timestamp (ms). */
    t: number;
    x: number;
    y: number;
    z: number;
    /** Facing yaw. */
    f: number;
    /** Horizontal speed as a fraction of max speed. */
    s: number;
    /** Grounded (1) or airborne (0). */
    g: 0 | 1;
    /** Vertical velocity. */
    v: number;
    /** Eliminated / out of play. */
    o: 0 | 1;
}
