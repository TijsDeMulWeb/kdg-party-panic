import Pusher from 'pusher-js';
import { apiRequest } from './api';

let client: Pusher | null = null;

/**
 * Shared Pusher-protocol connection. Works with Pusher Channels in
 * production; a self-hosted server only needs host, port and scheme.
 */
export function realtime(): Pusher {
    if (client) {
        return client;
    }

    const env = import.meta.env;
    const scheme = env.VITE_PUSHER_SCHEME ?? 'https';
    const port = env.VITE_PUSHER_PORT ? Number(env.VITE_PUSHER_PORT) : undefined;

    client = new Pusher(env.VITE_PUSHER_APP_KEY, {
        cluster: env.VITE_PUSHER_APP_CLUSTER || 'mt1',
        wsHost: env.VITE_PUSHER_HOST || undefined,
        wsPort: port,
        wssPort: port,
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
        channelAuthorization: {
            customHandler: ({ socketId, channelName }, callback) => {
                apiRequest<{ auth: string; channel_data?: string }>('POST', '/broadcasting/auth', { socket_id: socketId, channel_name: channelName })
                    .then((data) => callback(null, data))
                    .catch((error: Error) => callback(error, null));
            },
        },
    });

    return client;
}
