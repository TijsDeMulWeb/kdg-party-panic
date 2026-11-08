import { apiRequest } from './api';

/**
 * Estimates the offset between this device's clock and the server's, so
 * every client starts and ends a round at the same real moment.
 * Uses the sample with the lowest round-trip time (Cristian's algorithm).
 */
export class ServerClock {
    private offset = 0;

    async sync(samples = 5): Promise<void> {
        let bestRoundTrip = Infinity;

        for (let index = 0; index < samples; index++) {
            const sentAt = Date.now();
            const { now } = await apiRequest<{ now: number }>('GET', '/api/clock');
            const receivedAt = Date.now();
            const roundTrip = receivedAt - sentAt;

            if (roundTrip < bestRoundTrip) {
                bestRoundTrip = roundTrip;
                this.offset = now + roundTrip / 2 - receivedAt;
            }
        }
    }

    /** Current server time in milliseconds. */
    now(): number {
        return Date.now() + this.offset;
    }
}
