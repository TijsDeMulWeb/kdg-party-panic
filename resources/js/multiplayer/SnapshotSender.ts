import type { CharacterController } from '../characters/CharacterController';
import type { MinigameNetwork } from '../minigames/types';

/** Pusher allows 10 client events per second per connection; stay just under. */
const SEND_INTERVAL = 0.11;

const round = (value: number): number => Math.round(value * 100) / 100;

/** Throttles and compacts the local player's movement into snapshots. */
export class SnapshotSender {
    private elapsed = SEND_INTERVAL;

    constructor(private readonly network: MinigameNetwork) {}

    update(dt: number, controller: CharacterController, out: boolean, score?: number, extra?: () => number[]): void {
        this.elapsed += dt;

        if (this.elapsed < SEND_INTERVAL) {
            return;
        }

        this.elapsed = 0;
        const { position, velocity, facing, grounded } = controller.state;

        this.network.send({
            t: Math.round(this.network.serverNow()),
            x: round(position.x),
            y: round(position.y),
            z: round(position.z),
            f: round(facing),
            s: round(Math.hypot(velocity.x, velocity.z) / controller.config.maxSpeed),
            g: grounded ? 1 : 0,
            v: round(velocity.y),
            o: out ? 1 : 0,
            c: score,
            e: extra?.(),
        });
    }
}
