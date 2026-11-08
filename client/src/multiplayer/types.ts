/** Shapes returned by the Laravel API (see backend/app/Http/Resources). */

export interface Player {
    id: number;
    name: string;
    character: string | null;
    hat: string | null;
    is_guest: boolean;
    email: string | null;
}

export interface RoomPlayer {
    id: number;
    name: string;
    seat: number;
    is_ready: boolean;
    character: string;
    hat: string | null;
}

export interface RoundInfo {
    id: number;
    match_id: number;
    number: number;
    total_rounds: number;
    minigame: string;
    seed: number;
    /** Server time in milliseconds. */
    starts_at: number;
    ends_at: number;
    is_finished: boolean;
}

export interface MatchInfo {
    id: number;
    is_finished: boolean;
    minigames: string[];
    current_round: RoundInfo | null;
}

export interface RoundResultRow {
    player_id: number;
    score: number;
    /** Null when the player never reported (disconnected). */
    placement: number | null;
    points: number;
}

export interface StandingRow {
    player_id: number;
    name: string;
    character: string;
    total_points: number;
    total_score: number;
    rank: number;
}

export interface RoundOutcome {
    round: RoundInfo;
    is_finished: boolean;
    match_finished: boolean;
    results: RoundResultRow[];
    standings: StandingRow[];
}

export interface RoomState {
    code: string;
    host_id: number;
    max_players: number;
    min_players: number;
    active_match: MatchInfo | null;
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
    /** Live score. */
    c?: number;
    /** Minigame-specific extra values (e.g. ball position, claimed objects). */
    e?: number[];
}
