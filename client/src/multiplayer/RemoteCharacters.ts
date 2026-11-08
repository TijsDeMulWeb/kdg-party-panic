import * as THREE from 'three';
import { CharacterModel } from '../characters/CharacterModel';
import { createNameTag } from '../characters/NameTag';
import type { MinigameNetwork, NetworkPlayer } from '../minigames/types';
import type { MovingObstacle } from '../world/WorldWithMovingObstacles';
import type { PlayerSnapshot } from './types';
import { angleDelta } from '../utils/math';

/** Render remote players this far in the past so there are always two snapshots to blend. */
const INTERPOLATION_DELAY_MS = 150;
const BUFFER_SIZE = 24;

interface Remote {
    player: NetworkPlayer;
    model: CharacterModel;
    buffer: PlayerSnapshot[];
    lastGrounded: boolean;
    lastVertical: number;
    out: boolean;
    online: boolean;
}

/**
 * Shows other players from their snapshots, smoothly interpolated.
 * Shared by every minigame; each one just calls update() per frame.
 */
export class RemoteCharacters {
    private readonly remotes = new Map<number, Remote>();
    private readonly unsubscribers: (() => void)[] = [];

    constructor(
        scene: THREE.Scene,
        private readonly network: MinigameNetwork,
        private readonly onVanish: (position: THREE.Vector3) => void,
    ) {
        for (const player of network.remotePlayers) {
            const model = new CharacterModel(player.character);
            model.root.add(createNameTag(player.name, player.character.body, false, 1.7));
            model.root.visible = false;
            scene.add(model.root);
            this.remotes.set(player.id, { player, model, buffer: [], lastGrounded: true, lastVertical: 0, out: false, online: network.isOnline(player.id) });
        }

        this.unsubscribers.push(
            network.onSnapshot((playerId, snapshot) => this.receive(playerId, snapshot)),
            network.onPresence((online) => this.updatePresence(online)),
        );
    }

    update(dt: number): void {
        const renderTime = this.network.serverNow() - INTERPOLATION_DELAY_MS;

        for (const remote of this.remotes.values()) {
            const sample = this.sample(remote.buffer, renderTime);

            if (!sample || !remote.online) {
                continue;
            }

            const { model } = remote;
            model.root.visible = !remote.out || sample.y > -6;
            model.root.position.set(sample.x, sample.y, sample.z);
            model.root.rotation.y = sample.f;

            const grounded = sample.g === 1;
            if (grounded && !remote.lastGrounded) {
                model.land(Math.abs(remote.lastVertical));
            }
            if (!grounded && remote.lastGrounded && sample.v > 0) {
                model.jump();
            }
            remote.lastGrounded = grounded;
            remote.lastVertical = sample.v;

            model.update(dt, { speed: sample.s, grounded, verticalVelocity: sample.v });
        }
    }

    /** Current positions of visible remote players, for bumping. */
    obstacles(): MovingObstacle[] {
        const result: MovingObstacle[] = [];

        for (const remote of this.remotes.values()) {
            if (remote.model.root.visible && !remote.out) {
                const { x, y, z } = remote.model.root.position;
                result.push({ x, y, z, radius: 0.5 });
            }
        }

        return result;
    }

    dispose(): void {
        this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    }

    private receive(playerId: number, snapshot: PlayerSnapshot): void {
        const remote = this.remotes.get(playerId);

        if (!remote) {
            return;
        }

        remote.buffer.push(snapshot);
        remote.buffer.sort((a, b) => a.t - b.t);
        if (remote.buffer.length > BUFFER_SIZE) {
            remote.buffer.shift();
        }

        if (snapshot.o === 1 && !remote.out) {
            remote.out = true;
        }
    }

    private updatePresence(online: ReadonlySet<number>): void {
        for (const remote of this.remotes.values()) {
            const isOnline = online.has(remote.player.id);

            if (remote.online && !isOnline && remote.model.root.visible) {
                this.onVanish(remote.model.root.position.clone().setY(remote.model.root.position.y + 0.6));
                remote.model.root.visible = false;
            }

            remote.online = isOnline;
        }
    }

    /** Interpolated state at `time`, or the latest one if we ran past the buffer. */
    private sample(buffer: PlayerSnapshot[], time: number): PlayerSnapshot | null {
        if (buffer.length === 0) {
            return null;
        }

        if (time <= buffer[0].t) {
            return buffer[0];
        }

        for (let index = buffer.length - 1; index > 0; index--) {
            const previous = buffer[index - 1];
            const next = buffer[index];

            if (time >= previous.t && time <= next.t) {
                const t = next.t === previous.t ? 1 : (time - previous.t) / (next.t - previous.t);

                return {
                    ...next,
                    x: previous.x + (next.x - previous.x) * t,
                    y: previous.y + (next.y - previous.y) * t,
                    z: previous.z + (next.z - previous.z) * t,
                    f: previous.f + angleDelta(previous.f, next.f) * t,
                    s: previous.s + (next.s - previous.s) * t,
                    v: previous.v + (next.v - previous.v) * t,
                };
            }
        }

        return buffer[buffer.length - 1];
    }
}
